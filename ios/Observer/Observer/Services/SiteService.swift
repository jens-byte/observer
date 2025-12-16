import Foundation

actor SiteService {
    static let shared = SiteService()
    
    private init() {}
    
    func listSites(workspaceId: Int) async throws -> [Site] {
        try await APIClient.shared.request("/workspaces/\(workspaceId)/sites")
    }
    
    func getSite(workspaceId: Int, siteId: Int) async throws -> Site {
        try await APIClient.shared.request("/workspaces/\(workspaceId)/sites/\(siteId)")
    }
    
    func createSite(workspaceId: Int, request: CreateSiteRequest) async throws -> Site {
        try await APIClient.shared.request(
            "/workspaces/\(workspaceId)/sites",
            method: "POST",
            body: request
        )
    }
    
    func updateSite(workspaceId: Int, siteId: Int, request: UpdateSiteRequest) async throws -> Site {
        try await APIClient.shared.request(
            "/workspaces/\(workspaceId)/sites/\(siteId)",
            method: "PUT",
            body: request
        )
    }
    
    func deleteSite(workspaceId: Int, siteId: Int) async throws {
        try await APIClient.shared.requestVoid(
            "/workspaces/\(workspaceId)/sites/\(siteId)",
            method: "DELETE"
        )
    }
    
    func checkSite(workspaceId: Int, siteId: Int) async throws {
        struct CheckResponse: Codable {
            let status: String
        }
        let _: CheckResponse = try await APIClient.shared.request(
            "/workspaces/\(workspaceId)/sites/\(siteId)/check",
            method: "POST"
        )
    }
    
    func toggleStar(workspaceId: Int, siteId: Int) async throws -> Bool {
        struct StarResponse: Codable {
            let isStarred: Bool
        }
        let response: StarResponse = try await APIClient.shared.request(
            "/workspaces/\(workspaceId)/sites/\(siteId)/star",
            method: "POST"
        )
        return response.isStarred
    }
}
