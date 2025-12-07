import Foundation
import SwiftUI

@MainActor
class AuthManager: ObservableObject {
    static let shared = AuthManager()
    
    @Published var isAuthenticated = false
    @Published var isLoading = true
    @Published var user: User?
    @Published var workspaces: [Workspace] = []
    @Published var currentWorkspace: Workspace?
    @Published var error: String?
    
    private let workspaceIdKey = "currentWorkspaceId"
    
    private init() {
        Task {
            await checkAuth()
        }
    }
    
    // MARK: - Public Methods
    
    func login(email: String, password: String) async {
        error = nil
        isLoading = true
        
        do {
            let response: AuthResponse = try await APIClient.shared.request(
                "/auth/login",
                method: "POST",
                body: LoginRequest(email: email, password: password)
            )
            
            self.user = response.user
            self.workspaces = response.workspaces
            self.currentWorkspace = response.workspaces.first
            self.isAuthenticated = true
            
            if let workspace = currentWorkspace {
                UserDefaults.standard.set(workspace.id, forKey: workspaceIdKey)
            }
        } catch let apiError as APIError {
            self.error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func logout() async {
        do {
            try await APIClient.shared.requestVoid("/auth/logout", method: "POST")
        } catch {
            // Ignore logout errors
        }
        
        // Clear local state
        self.user = nil
        self.workspaces = []
        self.currentWorkspace = nil
        self.isAuthenticated = false
        UserDefaults.standard.removeObject(forKey: workspaceIdKey)
        
        // Clear cookies
        if let cookies = HTTPCookieStorage.shared.cookies {
            for cookie in cookies {
                HTTPCookieStorage.shared.deleteCookie(cookie)
            }
        }
    }
    
    func checkAuth() async {
        isLoading = true
        
        do {
            let response: AuthResponse = try await APIClient.shared.request("/auth/me")
            
            self.user = response.user
            self.workspaces = response.workspaces
            
            // Restore saved workspace or use first
            let savedId = UserDefaults.standard.integer(forKey: workspaceIdKey)
            self.currentWorkspace = response.workspaces.first { $0.id == savedId } ?? response.workspaces.first
            
            self.isAuthenticated = true
        } catch {
            self.isAuthenticated = false
            self.user = nil
            self.workspaces = []
            self.currentWorkspace = nil
        }
        
        isLoading = false
    }
    
    func selectWorkspace(_ workspace: Workspace) {
        currentWorkspace = workspace
        UserDefaults.standard.set(workspace.id, forKey: workspaceIdKey)
    }
    
    var canEdit: Bool {
        currentWorkspace?.role.canEdit ?? false
    }
}
