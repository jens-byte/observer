import Foundation

struct User: Codable, Identifiable {
    let id: Int
    let email: String
    let name: String
    let firstName: String?
    let lastName: String?
    let avatarUrl: String?
    let createdAt: String
    
    var displayName: String {
        [firstName, lastName].compactMap { $0 }.joined(separator: " ").isEmpty 
            ? name 
            : [firstName, lastName].compactMap { $0 }.joined(separator: " ")
    }
    
    var initials: String {
        let first = firstName?.first.map(String.init) ?? ""
        let last = lastName?.first.map(String.init) ?? ""
        return (first + last).uppercased().isEmpty ? "?" : (first + last).uppercased()
    }
}
