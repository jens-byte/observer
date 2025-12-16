import Foundation
import SwiftUI
import Combine

@MainActor
class DashboardViewModel: ObservableObject {
    @Published var sites: [Site] = []
    @Published var isLoading = false
    @Published var error: String?
    @Published var filterStatus: FilterStatus = .all
    
    private var refreshTask: Task<Void, Never>?
    
    enum FilterStatus: String, CaseIterable {
        case all = "All"
        case up = "Up"
        case down = "Down"
        case slow = "Slow"
        case ssl = "SSL"
    }
    
    var stats: DashboardStats {
        DashboardStats(from: sites)
    }
    
    var filteredSites: [Site] {
        let filtered: [Site]
        switch filterStatus {
        case .all:
            filtered = sites
        case .up:
            filtered = sites.filter { $0.lastStatus == .up && $0.isSlow != true }
        case .down:
            filtered = sites.filter { $0.lastStatus == .down }
        case .slow:
            filtered = sites.filter { $0.isSlow == true }
        case .ssl:
            filtered = sites.filter { ($0.sslDaysRemaining ?? 100) < 14 }
        }
        
        return filtered.sorted { a, b in
            if a.isStarred != b.isStarred {
                return a.isStarred
            }
            return a.name.localizedCaseInsensitiveCompare(b.name) == .orderedAscending
        }
    }
    
    var groupedSites: [(String, [Site])] {
        let groups: [(String, [Site])] = [
            ("Down", filteredSites.filter { $0.lastStatus == .down }),
            ("Slow", filteredSites.filter { $0.isSlow == true && $0.lastStatus != .down }),
            ("Up", filteredSites.filter { $0.lastStatus == .up && $0.isSlow != true }),
            ("Pending", filteredSites.filter { $0.lastStatus == nil || $0.lastStatus == .unknown })
        ]
        return groups.filter { !$0.1.isEmpty }
    }
    
    func loadSites() async {
        guard let workspaceId = AuthManager.shared.currentWorkspace?.id else { return }
        
        isLoading = sites.isEmpty
        error = nil
        
        do {
            let fetchedSites = try await SiteService.shared.listSites(workspaceId: workspaceId)
            self.sites = fetchedSites
        } catch let networkError as NetworkError {
            if case .unauthorized = networkError {
                await AuthManager.shared.logout()
            } else {
                self.error = networkError.errorDescription
            }
        } catch {
            self.error = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func startAutoRefresh() {
        refreshTask?.cancel()
        refreshTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 30_000_000_000)
                if !Task.isCancelled {
                    await loadSites()
                }
            }
        }
    }
    
    func stopAutoRefresh() {
        refreshTask?.cancel()
        refreshTask = nil
    }
    
    func deleteSite(_ site: Site) async {
        guard let workspaceId = AuthManager.shared.currentWorkspace?.id else { return }
        
        do {
            try await SiteService.shared.deleteSite(workspaceId: workspaceId, siteId: site.id)
            sites.removeAll { $0.id == site.id }
        } catch let networkError as NetworkError {
            self.error = networkError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }
    
    func toggleStar(_ site: Site) async {
        guard let workspaceId = AuthManager.shared.currentWorkspace?.id else { return }
        
        do {
            _ = try await SiteService.shared.toggleStar(workspaceId: workspaceId, siteId: site.id)
            await loadSites()
        } catch {
            // Ignore star errors
        }
    }
    
    func checkSite(_ site: Site) async {
        guard let workspaceId = AuthManager.shared.currentWorkspace?.id else { return }
        
        do {
            try await SiteService.shared.checkSite(workspaceId: workspaceId, siteId: site.id)
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            await loadSites()
        } catch {
            // Ignore check errors
        }
    }
}
