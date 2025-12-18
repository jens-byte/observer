import SwiftUI

struct DashboardView: View {
    @StateObject private var viewModel = DashboardViewModel()
    @ObservedObject var authManager = AuthManager.shared
    @State private var showAddSite = false
    @State private var selectedSite: Site?
    @State private var showWorkspacePicker = false
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                StatsBarView(stats: viewModel.stats, selectedFilter: $viewModel.filterStatus)
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                
                if viewModel.isLoading && viewModel.sites.isEmpty {
                    Spacer()
                    ProgressView()
                    Spacer()
                } else if viewModel.sites.isEmpty {
                    Spacer()
                    ContentUnavailableView("No Sites", systemImage: "globe", description: Text("Add your first site to start monitoring"))
                    Spacer()
                } else {
                    List {
                        ForEach(viewModel.groupedSites, id: \.0) { group, sites in
                            Section(group) {
                                ForEach(sites) { site in
                                    SiteRowView(site: site) { selectedSite = site }
                                        .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                                        .listRowBackground(Color.clear)
                                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                            if authManager.canEdit {
                                                Button(role: .destructive) {
                                                    Task { await viewModel.deleteSite(site) }
                                                } label: {
                                                    Label("Delete", systemImage: "trash")
                                                }
                                                Button {
                                                    selectedSite = site
                                                } label: {
                                                    Label("Edit", systemImage: "pencil")
                                                }
                                                .tint(.blue)
                                            }
                                        }
                                        .swipeActions(edge: .leading) {
                                            Button {
                                                Task { await viewModel.toggleStar(site) }
                                            } label: {
                                                Label(site.isStarred ? "Unstar" : "Star", systemImage: site.isStarred ? "star.slash" : "star")
                                            }
                                            .tint(.yellow)
                                        }
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                    .refreshable { await viewModel.loadSites() }
                }
                
                if let error = viewModel.error {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.white)
                        .padding(.horizontal)
                        .padding(.vertical, 8)
                        .frame(maxWidth: .infinity)
                        .background(Color.red)
                }
            }
            .navigationTitle(authManager.currentWorkspace?.name ?? "Observer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showWorkspacePicker = true
                    } label: {
                        HStack(spacing: 4) {
                            Text(authManager.currentWorkspace?.name ?? "Workspace")
                                .font(.headline)
                            Image(systemName: "chevron.down")
                                .font(.caption)
                        }
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 8) {
                        if authManager.canEdit {
                            Button { showAddSite = true } label: {
                                Image(systemName: "plus")
                            }
                        }
                        Menu {
                            Button {
                                Task { await authManager.logout() }
                            } label: {
                                Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                            }
                        } label: {
                            Image(systemName: "person.circle")
                        }
                    }
                }
            }
            .sheet(isPresented: $showAddSite) {
                AddSiteSheet { await viewModel.loadSites() }
            }
            .sheet(item: $selectedSite) { site in
                SiteDetailView(site: site) { await viewModel.loadSites() }
            }
            .confirmationDialog("Select Workspace", isPresented: $showWorkspacePicker, titleVisibility: .visible) {
                ForEach(authManager.workspaces) { workspace in
                    Button(workspace.name) {
                        authManager.selectWorkspace(workspace)
                        Task { await viewModel.loadSites() }
                    }
                }
            }
        }
        .task {
            await viewModel.loadSites()
            viewModel.startAutoRefresh()
        }
        .onDisappear {
            viewModel.stopAutoRefresh()
        }
    }
}
