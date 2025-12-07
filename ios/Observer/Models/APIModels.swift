import Foundation

// MARK: - Auth

struct LoginRequest: Codable {
    let email: String
    let password: String
}

struct AuthResponse: Codable {
    let user: User
    let workspaces: [Workspace]
}

struct APIError: Codable {
    let error: String
    let message: String?
}

// MARK: - Dashboard Stats

struct DashboardStats {
    let total: Int
    let up: Int
    let down: Int
    let slow: Int
    let sslWarnings: Int
    
    static var empty: DashboardStats {
        DashboardStats(total: 0, up: 0, down: 0, slow: 0, sslWarnings: 0)
    }
    
    init(from sites: [Site]) {
        self.total = sites.count
        self.up = sites.filter { $0.lastStatus == .up && $0.isSlow != true }.count
        self.down = sites.filter { $0.lastStatus == .down }.count
        self.slow = sites.filter { $0.isSlow == true }.count
        self.sslWarnings = sites.filter { ($0.sslDaysRemaining ?? 100) < 14 }.count
    }
    
    init(total: Int, up: Int, down: Int, slow: Int, sslWarnings: Int) {
        self.total = total
        self.up = up
        self.down = down
        self.slow = slow
        self.sslWarnings = sslWarnings
    }
}
