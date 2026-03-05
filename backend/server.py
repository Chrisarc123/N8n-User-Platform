from fastapi import FastAPI, APIRouter, Depends, HTTPException, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import jwt
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Any
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'change-me-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI()
api_router = APIRouter(prefix="/api")

# =================== Models ===================

class LoginRequest(BaseModel):
    email: str
    password: str

class UserCreate(BaseModel):
    email: str
    name: str
    password: str
    role: str = "client"

class UserUpdate(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class InputField(BaseModel):
    name: str
    type: str = "text"
    label: str
    required: bool = False
    options: List[str] = []

class WorkflowCreate(BaseModel):
    name: str
    description: str = ""
    webhook_url: str
    n8n_workflow_id: str = ""
    input_schema: List[InputField] = []

class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    webhook_url: Optional[str] = None
    n8n_workflow_id: Optional[str] = None
    input_schema: Optional[List[Any]] = None
    is_active: Optional[bool] = None

class AssignmentCreate(BaseModel):
    user_id: str
    workflow_id: str
    can_view: bool = True
    can_trigger: bool = False
    can_download: bool = False

class AssignmentUpdate(BaseModel):
    can_view: Optional[bool] = None
    can_trigger: Optional[bool] = None
    can_download: Optional[bool] = None

class ExecutionTrigger(BaseModel):
    input_data: dict = {}

class SettingsUpdate(BaseModel):
    n8n_base_url: Optional[str] = None
    n8n_api_key: Optional[str] = None

class WebhookCallback(BaseModel):
    execution_id: str
    status: str = "success"
    output_data: Any = None

# =================== Auth Helpers ===================

def create_token(user_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ")[1]
    payload = verify_token(token)
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def get_admin_user(user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# =================== Auth Routes ===================

@api_router.post("/auth/login")
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email}, {"_id": 0})
    if not user or not pwd_context.verify(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account disabled")
    token = create_token(user["id"], user["role"])
    safe_user = {k: v for k, v in user.items() if k != "password_hash"}
    return {"token": token, "user": safe_user}

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    return {k: v for k, v in user.items() if k != "password_hash"}

# =================== User Routes ===================

@api_router.get("/users")
async def list_users(user=Depends(get_admin_user)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@api_router.post("/users")
async def create_user(req: UserCreate, user=Depends(get_admin_user)):
    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    new_user = {
        "id": str(uuid.uuid4()),
        "email": req.email,
        "name": req.name,
        "password_hash": pwd_context.hash(req.password),
        "role": req.role,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(new_user)
    return {k: v for k, v in new_user.items() if k not in ("_id", "password_hash")}

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, req: UserUpdate, user=Depends(get_admin_user)):
    updates = {k: v for k, v in req.model_dump(exclude_none=True).items()}
    if "password" in updates:
        updates["password_hash"] = pwd_context.hash(updates.pop("password"))
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.users.update_one({"id": user_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return updated

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, user=Depends(get_admin_user)):
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    await db.client_workflows.delete_many({"user_id": user_id})
    return {"message": "User deleted"}

# =================== Workflow Routes ===================

@api_router.get("/workflows")
async def list_workflows(user=Depends(get_current_user)):
    if user["role"] == "admin":
        workflows = await db.workflows.find({}, {"_id": 0}).to_list(1000)
    else:
        assignments = await db.client_workflows.find(
            {"user_id": user["id"], "can_view": True}, {"_id": 0}
        ).to_list(1000)
        workflow_ids = [a["workflow_id"] for a in assignments]
        workflows = await db.workflows.find(
            {"id": {"$in": workflow_ids}, "is_active": True}, {"_id": 0}
        ).to_list(1000)
        perm_map = {a["workflow_id"]: a for a in assignments}
        for w in workflows:
            perm = perm_map.get(w["id"], {})
            w["permissions"] = {
                "can_view": perm.get("can_view", False),
                "can_trigger": perm.get("can_trigger", False),
                "can_download": perm.get("can_download", False)
            }
    return workflows

@api_router.post("/workflows")
async def create_workflow(req: WorkflowCreate, user=Depends(get_admin_user)):
    new_wf = {
        "id": str(uuid.uuid4()),
        **req.model_dump(),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.workflows.insert_one(new_wf)
    return {k: v for k, v in new_wf.items() if k != "_id"}

@api_router.get("/workflows/{workflow_id}")
async def get_workflow(workflow_id: str, user=Depends(get_current_user)):
    wf = await db.workflows.find_one({"id": workflow_id}, {"_id": 0})
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if user["role"] != "admin":
        assignment = await db.client_workflows.find_one(
            {"user_id": user["id"], "workflow_id": workflow_id, "can_view": True}, {"_id": 0}
        )
        if not assignment:
            raise HTTPException(status_code=403, detail="Access denied")
        wf["permissions"] = {
            "can_view": assignment.get("can_view", False),
            "can_trigger": assignment.get("can_trigger", False),
            "can_download": assignment.get("can_download", False)
        }
    return wf

@api_router.put("/workflows/{workflow_id}")
async def update_workflow(workflow_id: str, req: WorkflowUpdate, user=Depends(get_admin_user)):
    updates = req.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.workflows.update_one({"id": workflow_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Workflow not found")
    updated = await db.workflows.find_one({"id": workflow_id}, {"_id": 0})
    return updated

@api_router.delete("/workflows/{workflow_id}")
async def delete_workflow(workflow_id: str, user=Depends(get_admin_user)):
    result = await db.workflows.delete_one({"id": workflow_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Workflow not found")
    await db.client_workflows.delete_many({"workflow_id": workflow_id})
    await db.executions.delete_many({"workflow_id": workflow_id})
    return {"message": "Workflow deleted"}

# =================== Trigger Workflow ===================

@api_router.post("/workflows/{workflow_id}/trigger")
async def trigger_workflow(workflow_id: str, req: ExecutionTrigger, user=Depends(get_current_user)):
    wf = await db.workflows.find_one({"id": workflow_id}, {"_id": 0})
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if user["role"] != "admin":
        assignment = await db.client_workflows.find_one(
            {"user_id": user["id"], "workflow_id": workflow_id, "can_trigger": True}, {"_id": 0}
        )
        if not assignment:
            raise HTTPException(status_code=403, detail="No trigger permission")

    execution_id = str(uuid.uuid4())
    execution = {
        "id": execution_id,
        "workflow_id": workflow_id,
        "workflow_name": wf["name"],
        "triggered_by": user["id"],
        "triggered_by_name": user["name"],
        "status": "running",
        "input_data": req.input_data,
        "output_data": None,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None
    }
    await db.executions.insert_one(execution)

    try:
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            response = await http_client.post(
                wf["webhook_url"],
                json={**req.input_data, "execution_id": execution_id}
            )
            if response.status_code == 200:
                try:
                    output = response.json()
                except Exception:
                    output = {"raw": response.text}
                now = datetime.now(timezone.utc).isoformat()
                await db.executions.update_one(
                    {"id": execution_id},
                    {"$set": {"status": "success", "output_data": output, "completed_at": now}}
                )
                execution["status"] = "success"
                execution["output_data"] = output
                execution["completed_at"] = now
            else:
                now = datetime.now(timezone.utc).isoformat()
                err_data = {"error": f"Webhook returned {response.status_code}", "body": response.text[:500]}
                await db.executions.update_one(
                    {"id": execution_id},
                    {"$set": {"status": "error", "output_data": err_data, "completed_at": now}}
                )
                execution["status"] = "error"
                execution["output_data"] = err_data
                execution["completed_at"] = now
    except Exception as e:
        now = datetime.now(timezone.utc).isoformat()
        err_data = {"error": str(e)}
        await db.executions.update_one(
            {"id": execution_id},
            {"$set": {"status": "error", "output_data": err_data, "completed_at": now}}
        )
        execution["status"] = "error"
        execution["output_data"] = err_data
        execution["completed_at"] = now

    return {k: v for k, v in execution.items() if k != "_id"}

# =================== Execution Routes ===================

@api_router.get("/executions")
async def list_executions(user=Depends(get_current_user), workflow_id: str = None, limit: int = 50):
    query = {}
    if user["role"] != "admin":
        assignments = await db.client_workflows.find(
            {"user_id": user["id"], "can_view": True}, {"_id": 0}
        ).to_list(1000)
        wf_ids = [a["workflow_id"] for a in assignments]
        query["workflow_id"] = {"$in": wf_ids}
    if workflow_id:
        query["workflow_id"] = workflow_id
    executions = await db.executions.find(query, {"_id": 0}).sort("started_at", -1).to_list(limit)
    return executions

@api_router.get("/executions/{execution_id}")
async def get_execution(execution_id: str, user=Depends(get_current_user)):
    execution = await db.executions.find_one({"id": execution_id}, {"_id": 0})
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    if user["role"] != "admin":
        assignment = await db.client_workflows.find_one(
            {"user_id": user["id"], "workflow_id": execution["workflow_id"], "can_view": True}
        )
        if not assignment:
            raise HTTPException(status_code=403, detail="Access denied")
    return execution

# =================== Assignment Routes ===================

@api_router.get("/assignments")
async def list_assignments(user=Depends(get_admin_user), user_id: str = None, workflow_id: str = None):
    query = {}
    if user_id:
        query["user_id"] = user_id
    if workflow_id:
        query["workflow_id"] = workflow_id
    assignments = await db.client_workflows.find(query, {"_id": 0}).to_list(1000)
    return assignments

@api_router.post("/assignments")
async def create_assignment(req: AssignmentCreate, user=Depends(get_admin_user)):
    existing = await db.client_workflows.find_one(
        {"user_id": req.user_id, "workflow_id": req.workflow_id}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Assignment already exists")
    assignment = {
        "id": str(uuid.uuid4()),
        **req.model_dump(),
        "assigned_at": datetime.now(timezone.utc).isoformat()
    }
    await db.client_workflows.insert_one(assignment)
    return {k: v for k, v in assignment.items() if k != "_id"}

@api_router.put("/assignments/{assignment_id}")
async def update_assignment(assignment_id: str, req: AssignmentUpdate, user=Depends(get_admin_user)):
    updates = req.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.client_workflows.update_one({"id": assignment_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Assignment not found")
    updated = await db.client_workflows.find_one({"id": assignment_id}, {"_id": 0})
    return updated

@api_router.delete("/assignments/{assignment_id}")
async def delete_assignment(assignment_id: str, user=Depends(get_admin_user)):
    result = await db.client_workflows.delete_one({"id": assignment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return {"message": "Assignment deleted"}

# =================== Settings Routes ===================

@api_router.get("/settings")
async def get_settings(user=Depends(get_admin_user)):
    settings = await db.settings.find_one({}, {"_id": 0})
    if not settings:
        settings = {"n8n_base_url": "", "n8n_api_key": ""}
    return settings

@api_router.put("/settings")
async def update_settings(req: SettingsUpdate, user=Depends(get_admin_user)):
    updates = req.model_dump(exclude_none=True)
    await db.settings.update_one({}, {"$set": updates}, upsert=True)
    settings = await db.settings.find_one({}, {"_id": 0})
    return settings

# =================== N8N Callback ===================

@api_router.post("/n8n/callback")
async def n8n_callback(req: WebhookCallback):
    updates = {
        "status": req.status,
        "output_data": req.output_data,
        "completed_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.executions.update_one({"id": req.execution_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Execution not found")
    return {"message": "Callback received"}

# =================== Stats ===================

@api_router.get("/stats")
async def get_stats(user=Depends(get_admin_user)):
    total_clients = await db.users.count_documents({"role": "client"})
    active_workflows = await db.workflows.count_documents({"is_active": True})
    total_executions = await db.executions.count_documents({})
    successful = await db.executions.count_documents({"status": "success"})
    failed = await db.executions.count_documents({"status": "error"})
    recent = await db.executions.find({}, {"_id": 0}).sort("started_at", -1).to_list(10)
    return {
        "total_clients": total_clients,
        "active_workflows": active_workflows,
        "total_executions": total_executions,
        "successful_executions": successful,
        "failed_executions": failed,
        "recent_executions": recent
    }

@api_router.get("/client/stats")
async def get_client_stats(user=Depends(get_current_user)):
    assignments = await db.client_workflows.find(
        {"user_id": user["id"], "can_view": True}, {"_id": 0}
    ).to_list(1000)
    workflow_ids = [a["workflow_id"] for a in assignments]
    total_executions = await db.executions.count_documents({"workflow_id": {"$in": workflow_ids}})
    recent = await db.executions.find(
        {"workflow_id": {"$in": workflow_ids}}, {"_id": 0}
    ).sort("started_at", -1).to_list(5)
    return {
        "total_workflows": len(workflow_ids),
        "total_executions": total_executions,
        "recent_executions": recent
    }

@api_router.get("/health")
async def health():
    return {"status": "ok"}

# =================== App Setup ===================

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup():
    admin = await db.users.find_one({"role": "admin"})
    if not admin:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": "admin@flowportal.com",
            "name": "Admin",
            "password_hash": pwd_context.hash("admin123"),
            "role": "admin",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info("Default admin created: admin@flowportal.com / admin123")

    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.workflows.create_index("id", unique=True)
    await db.executions.create_index("id", unique=True)
    await db.executions.create_index("workflow_id")
    await db.client_workflows.create_index([("user_id", 1), ("workflow_id", 1)], unique=True)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
