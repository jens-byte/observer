import Foundation

enum SiteStatus: String, Codable {
    case up
    case down
    case unknown
}

struct Site: Codable, Identifiable {
    let id: Int
    let workspaceId: Int
    let name: String
    let url: String
    let checkInterval: Int
    let isActive: Bool
    let isStarred: Bool
    let isSla: Bool
    let license: String?
    let lastStatus: SiteStatus?
    let lastResponseTime: Int?
    let lastCheckedAt: String?
    let consecutiveFailures: Int
    let confirmedDownAt: String?
    let downNotified: Bool
    let createdAt: String
    
    // Computed fields from SiteWithDetails
    let isSlow: Bool?
    let uptime: Double?
    let responseHistory: [Int]?
    let sslDaysRemaining: Int?
    let sslValidTo: String?
    let nameservers: String?
    let ipAddress: String?
    let cmsName: String?
    let cmsVersion: String?
    
    var effectiveStatus: SiteStatus {
        lastStatus ?? .unknown
    }
    
    var lastCheckedDate: Date? {
        guard let dateString = lastCheckedAt else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: dateString) ?? ISO8601DateFormatter().date(from: dateString)
    }
    
    var lastCheckedAgo: String {
        guard let date = lastCheckedDate else { return "Never" }
        let interval = Date().timeIntervalSince(date)
        
        if interval < 60 {
            return "Just now"
        } else if interval < 3600 {
            let minutes = Int(interval / 60)
            return "\(minutes)m ago"
        } else if interval < 86400 {
            let hours = Int(interval / 3600)
            return "\(hours)h ago"
        } else {
            let days = Int(interval / 86400)
            return "\(days)d ago"
        }
    }
}

struct CreateSiteRequest: Codable {
    let name: String
    let url: String
    let checkInterval: Int?
    
    init(name: String, url: String, checkInterval: Int? = nil) {
        self.name = name
        self.url = url
        self.checkInterval = checkInterval
    }
}

struct UpdateSiteRequest: Codable {
    var name: String?
    var url: String?
    var checkInterval: Int?
    var isActive: Bool?
    var isStarred: Bool?
}
