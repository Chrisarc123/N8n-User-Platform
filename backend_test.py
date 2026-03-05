#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class FlowPortalAPITester:
    def __init__(self, base_url="https://automation-ui.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.client_token = None
        self.test_client_id = None
        self.test_workflow_id = None
        self.tests_run = 0
        self.tests_passed = 0

    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        self.log(f"🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ {name} - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {"raw": response.text}
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}")
                self.log(f"   Response: {response.text[:200]}")
                return False, {"error": response.text}

        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}")
            return False, {"error": str(e)}

    def test_health_check(self):
        """Test health endpoint"""
        return self.run_test("Health Check", "GET", "health", 200)

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@flowportal.com", "password": "admin123"}
        )
        
        if success and 'token' in response:
            self.admin_token = response['token']
            self.log(f"   Admin token obtained: {self.admin_token[:20]}...")
            return True
        return False

    def test_get_me_admin(self):
        """Test /auth/me with admin token"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        return self.run_test("Get Admin Profile", "GET", "auth/me", 200, headers=headers)

    def test_get_stats(self):
        """Test admin stats endpoint"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        return self.run_test("Get Stats", "GET", "stats", 200, headers=headers)

    def test_list_users(self):
        """Test list users endpoint"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        return self.run_test("List Users", "GET", "users", 200, headers=headers)

    def test_create_client_user(self):
        """Test creating a client user"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        timestamp = datetime.now().strftime('%H%M%S')
        user_data = {
            "email": f"testclient{timestamp}@test.com",
            "name": f"Test Client {timestamp}",
            "password": "testpassword123",
            "role": "client"
        }
        
        success, response = self.run_test(
            "Create Client User",
            "POST",
            "users",
            200,
            data=user_data,
            headers=headers
        )
        
        if success and 'id' in response:
            self.test_client_id = response['id']
            self.log(f"   Client ID created: {self.test_client_id}")
            return True
        return False

    def test_client_login(self):
        """Test client login"""
        if not self.test_client_id:
            return False
            
        timestamp = datetime.now().strftime('%H%M%S')
        success, response = self.run_test(
            "Client Login",
            "POST",
            "auth/login",
            200,
            data={"email": f"testclient{timestamp}@test.com", "password": "testpassword123"}
        )
        
        if success and 'token' in response:
            self.client_token = response['token']
            self.log(f"   Client token obtained: {self.client_token[:20]}...")
            return True
        return False

    def test_create_workflow(self):
        """Test creating a workflow"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        workflow_data = {
            "name": f"Test Workflow {datetime.now().strftime('%H%M%S')}",
            "description": "A test workflow for API testing",
            "webhook_url": "https://httpbin.org/post",
            "n8n_workflow_id": "test123",
            "input_schema": [
                {
                    "name": "test_field",
                    "label": "Test Field",
                    "type": "text",
                    "required": True,
                    "options": []
                }
            ]
        }
        
        success, response = self.run_test(
            "Create Workflow",
            "POST",
            "workflows",
            200,
            data=workflow_data,
            headers=headers
        )
        
        if success and 'id' in response:
            self.test_workflow_id = response['id']
            self.log(f"   Workflow ID created: {self.test_workflow_id}")
            return True
        return False

    def test_list_workflows_admin(self):
        """Test listing workflows as admin"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        return self.run_test("List Workflows (Admin)", "GET", "workflows", 200, headers=headers)

    def test_list_workflows_client(self):
        """Test listing workflows as client (should be empty initially)"""
        headers = {"Authorization": f"Bearer {self.client_token}"}
        return self.run_test("List Workflows (Client)", "GET", "workflows", 200, headers=headers)

    def test_create_assignment(self):
        """Test creating workflow assignment"""
        if not self.test_client_id or not self.test_workflow_id:
            return False
            
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        assignment_data = {
            "user_id": self.test_client_id,
            "workflow_id": self.test_workflow_id,
            "can_view": True,
            "can_trigger": True,
            "can_download": True
        }
        
        return self.run_test(
            "Create Assignment",
            "POST",
            "assignments",
            200,
            data=assignment_data,
            headers=headers
        )[0]

    def test_trigger_workflow(self):
        """Test triggering workflow as client"""
        if not self.test_workflow_id:
            return False
            
        headers = {"Authorization": f"Bearer {self.client_token}"}
        trigger_data = {
            "input_data": {"test_field": "test value"}
        }
        
        return self.run_test(
            "Trigger Workflow",
            "POST",
            f"workflows/{self.test_workflow_id}/trigger",
            200,
            data=trigger_data,
            headers=headers
        )[0]

    def test_list_executions(self):
        """Test listing executions"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        return self.run_test("List Executions", "GET", "executions", 200, headers=headers)

    def test_get_settings(self):
        """Test get settings endpoint"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        return self.run_test("Get Settings", "GET", "settings", 200, headers=headers)

    def cleanup(self):
        """Clean up test data"""
        self.log("🧹 Cleaning up test data...")
        
        # Delete test workflow
        if self.test_workflow_id and self.admin_token:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            self.run_test("Delete Test Workflow", "DELETE", f"workflows/{self.test_workflow_id}", 200, headers=headers)
        
        # Delete test client
        if self.test_client_id and self.admin_token:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            self.run_test("Delete Test Client", "DELETE", f"users/{self.test_client_id}", 200, headers=headers)

def main():
    print("🚀 Starting FlowPortal API Tests")
    print("=" * 50)
    
    tester = FlowPortalAPITester()
    
    try:
        # Core API tests
        tests = [
            ("Health Check", tester.test_health_check),
            ("Admin Login", tester.test_admin_login),
            ("Get Admin Profile", tester.test_get_me_admin),
            ("Get Stats", tester.test_get_stats),
            ("List Users", tester.test_list_users),
            ("Create Client User", tester.test_create_client_user),
            ("Client Login", tester.test_client_login),
            ("Create Workflow", tester.test_create_workflow),
            ("List Workflows (Admin)", tester.test_list_workflows_admin),
            ("List Workflows (Client)", tester.test_list_workflows_client),
            ("Create Assignment", tester.test_create_assignment),
            ("Trigger Workflow", tester.test_trigger_workflow),
            ("List Executions", tester.test_list_executions),
            ("Get Settings", tester.test_get_settings),
        ]
        
        for test_name, test_func in tests:
            if not test_func():
                print(f"⚠️  {test_name} failed, but continuing...")
    
    except KeyboardInterrupt:
        print("\n⚠️  Tests interrupted by user")
    
    except Exception as e:
        print(f"💥 Unexpected error: {str(e)}")
    
    finally:
        # Always try to cleanup
        tester.cleanup()
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"   Success Rate: {success_rate:.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"❌ {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())