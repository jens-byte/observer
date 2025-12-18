import SwiftUI

struct AddSiteSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var authManager = AuthManager.shared
    
    @State private var name = ""
    @State private var url = ""
    @State private var isAdding = false
    @State private var error: String?
    
    let onAdded: () async -> Void
    
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Site Name", text: $name)
                        .textContentType(.name)
                    
                    TextField("URL", text: $url)
                        .textContentType(.URL)
                        .autocapitalization(.none)
                        .keyboardType(.URL)
                }
                
                if let error = error {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                            .font(.caption)
                    }
                }
            }
            .navigationTitle("Add Site")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        Task {
                            await addSite()
                        }
                    }
                    .disabled(name.isEmpty || url.isEmpty || isAdding)
                }
            }
            .interactiveDismissDisabled(isAdding)
        }
    }
    
    private func addSite() async {
        guard let workspaceId = authManager.currentWorkspace?.id else { return }
        
        isAdding = true
        error = nil
        
        // Normalize URL
        var normalizedUrl = url.trimmingCharacters(in: .whitespacesAndNewlines)
        if !normalizedUrl.lowercased().hasPrefix("http://") && 
           !normalizedUrl.lowercased().hasPrefix("https://") {
            normalizedUrl = "https://\(normalizedUrl)"
        }
        
        do {
            _ = try await SiteService.shared.createSite(
                workspaceId: workspaceId,
                request: CreateSiteRequest(name: name, url: normalizedUrl)
            )
            await onAdded()
            dismiss()
        } catch let networkError as NetworkError {
            error = networkError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
        
        isAdding = false
    }
}

#Preview {
    AddSiteSheet { }
}
