import SwiftUI

struct ContentView: View {
    @ObservedObject private var authManager = AuthManager.shared
    
    var body: some View {
        Group {
            if authManager.isLoading && !authManager.initialized {
                // Loading state
                VStack(spacing: 16) {
                    ZStack {
                        Circle()
                            .fill(Color.primary)
                            .frame(width: 60, height: 60)
                        Circle()
                            .fill(Color(UIColor.systemBackground))
                            .frame(width: 22, height: 22)
                    }
                    ProgressView()
                }
            } else if authManager.isAuthenticated {
                DashboardView()
            } else {
                LoginView()
            }
        }
        .animation(.easeInOut, value: authManager.isAuthenticated)
        .animation(.easeInOut, value: authManager.isLoading)
    }
}

#Preview {
    ContentView()
}
