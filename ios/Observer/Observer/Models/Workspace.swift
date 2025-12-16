import Foundation

struct Workspace: Codable, Identifiable, Hashable {
    let id: Int
    let name: String
    let slug: String
    let createdAt: String
    let role: WorkspaceRole
}

enum WorkspaceRole: String, Codable {
    case owner
    case editor
    case guest
    
    var canEdit: Bool {
        self == .owner || self == .editor
    }
}
