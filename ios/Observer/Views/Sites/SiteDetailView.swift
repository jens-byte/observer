import SwiftUI

struct SiteDetailView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var authManager = AuthManager.shared
    
    let site: Site
    let onUpdate: () async -> Void
    
    @State private var isEditing = false
    @State private var editName: String = ""
    @State private var editUrl: String = ""
    @State private var isSaving = false
    @State private var isDeleting = false
    @State private var showDeleteConfirm = false
    @State private var error: String?
    @State private var isChecking = false
    
    var body: some View {
        NavigationStack {
            List {
                // Status Section
                Section {
                    HStack {
                        Text("Status")
                        Spacer()
                        HStack(spacing: 6) {
                            StatusDot(
                                status: site.lastStatus,
                                isSlow: site.isSlow ?? false,
                                size: 10
                            )
                            Text(statusText)
                                .foregroundStyle(statusColor)
                        }
                    }
                    
                    if let responseTime = site.lastResponseTime {
                        HStack {
                            Text("Response Time")
                            Spacer()
                            Text("\(responseTime)ms")
                                .foregroundStyle(.secondary)
                        }
                    }
                    
                    HStack {
                        Text("Last Checked")
                        Spacer()
                        Text(site.lastCheckedAgo)
                            .foregroundStyle(.secondary)
                    }
                    
                    Button {
                        Task {
                            isChecking = true
                            guard let workspaceId = authManager.currentWorkspace?.id else { return }
                            try? await SiteService.shared.checkSite(workspaceId: workspaceId, siteId: site.id)
                            try? await Task.sleep(nanoseconds: 1_500_000_000)
                            await onUpdate()
                            isChecking = false
                        }
                    } label: {
                        HStack {
                            if isChecking {
                                ProgressView()
                                    .controlSize(.small)
                            }
                            Text("Check Now")
                        }
                    }
                    .disabled(isChecking)
                }
                
                // Details Section
                Section("Details") {
                    if isEditing {
                        TextField("Name", text: $editName)
                        TextField("URL", text: $editUrl)
                            .autocapitalization(.none)
                            .keyboardType(.URL)
                    } else {
                        LabeledContent("Name", value: site.name)
                        LabeledContent("URL", value: site.url)
                    }
                    
                    LabeledContent("Check Interval", value: "\(site.checkInterval) min")
                    LabeledContent("Active", value: site.isActive ? "Yes" : "No")
                    LabeledContent("Starred", value: site.isStarred ? "Yes" : "No")
                }
                
                // SSL Section
                if site.sslDaysRemaining != nil || site.sslValidTo != nil {
                    Section("SSL Certificate") {
                        if let days = site.sslDaysRemaining {
                            HStack {
                                Text("Days Remaining")
                                Spacer()
                                Text("\(days)")
                                    .foregroundStyle(days < 14 ? .orange : .secondary)
                            }
                        }
                        
                        if let validTo = site.sslValidTo {
                            LabeledContent("Valid Until", value: validTo)
                        }
                    }
                }
                
                // Info Section
                Section("Technical Info") {
                    if let ip = site.ipAddress {
                        LabeledContent("IP Address", value: ip)
                    }
                    
                    if let ns = site.nameservers {
                        LabeledContent("Nameservers", value: ns)
                    }
                    
                    if let cms = site.cmsName {
                        LabeledContent("CMS", value: site.cmsVersion.map { "\(cms) \($0)" } ?? cms)
                    }
                }
                
                // Error
                if let error = error {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                            .font(.caption)
                    }
                }
                
                // Delete Button
                if authManager.canEdit {
                    Section {
                        Button(role: .destructive) {
                            showDeleteConfirm = true
                        } label: {
                            HStack {
                                Spacer()
                                if isDeleting {
                                    ProgressView()
                                        .controlSize(.small)
                                }
                                Text("Delete Site")
                                Spacer()
                            }
                        }
                        .disabled(isDeleting)
                    }
                }
            }
            .navigationTitle(site.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(isEditing ? "Cancel" : "Done") {
                        if isEditing {
                            isEditing = false
                            editName = site.name
                            editUrl = site.url
                        } else {
                            dismiss()
                        }
                    }
                }
                
                if authManager.canEdit {
                    ToolbarItem(placement: .primaryAction) {
                        if isEditing {
                            Button("Save") {
                                Task {
                                    await saveSite()
                                }
                            }
                            .disabled(isSaving || editName.isEmpty || editUrl.isEmpty)
                        } else {
                            Button("Edit") {
                                editName = site.name
                                editUrl = site.url
                                isEditing = true
                            }
                        }
                    }
                }
            }
            .alert("Delete Site", isPresented: $showDeleteConfirm) {
                Button("Cancel", role: .cancel) { }
                Button("Delete", role: .destructive) {
                    Task {
                        await deleteSite()
                    }
                }
            } message: {
                Text("Are you sure you want to delete '\(site.name)'? This action cannot be undone.")
            }
        }
        .interactiveDismissDisabled(isEditing || isSaving || isDeleting)
    }
    
    private var statusText: String {
        if site.lastStatus == .down { return "Down" }
        if site.isSlow == true { return "Slow" }
        if site.lastStatus == .up { return "Up" }
        return "Unknown"
    }
    
    private var statusColor: Color {
        if site.lastStatus == .down { return .red }
        if site.isSlow == true { return .orange }
        if site.lastStatus == .up { return .green }
        return .secondary
    }
    
    private func saveSite() async {
        guard let workspaceId = authManager.currentWorkspace?.id else { return }
        
        isSaving = true
        error = nil
        
        var request = UpdateSiteRequest()
        if editName != site.name { request.name = editName }
        if editUrl != site.url { request.url = editUrl }
        
        do {
            _ = try await SiteService.shared.updateSite(
                workspaceId: workspaceId,
                siteId: site.id,
                request: request
            )
            await onUpdate()
            isEditing = false
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
        
        isSaving = false
    }
    
    private func deleteSite() async {
        guard let workspaceId = authManager.currentWorkspace?.id else { return }
        
        isDeleting = true
        error = nil
        
        do {
            try await SiteService.shared.deleteSite(workspaceId: workspaceId, siteId: site.id)
            await onUpdate()
            dismiss()
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
        
        isDeleting = false
    }
}
