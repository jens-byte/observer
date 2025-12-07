import SwiftUI

struct StatsBarView: View {
    let stats: DashboardStats
    @Binding var selectedFilter: DashboardViewModel.FilterStatus
    
    var body: some View {
        HStack(spacing: 8) {
            StatButton(
                label: "Total",
                value: stats.total,
                isSelected: selectedFilter == .all
            ) {
                selectedFilter = .all
            }
            
            StatButton(
                label: "Up",
                value: stats.up,
                isSelected: selectedFilter == .up
            ) {
                selectedFilter = .up
            }
            
            StatButton(
                label: "Slow",
                value: stats.slow,
                isSelected: selectedFilter == .slow
            ) {
                selectedFilter = .slow
            }
            
            StatButton(
                label: "Down",
                value: stats.down,
                isSelected: selectedFilter == .down
            ) {
                selectedFilter = .down
            }
            
            StatButton(
                label: "SSL",
                value: stats.sslWarnings,
                isSelected: selectedFilter == .ssl
            ) {
                selectedFilter = .ssl
            }
        }
    }
}

struct StatButton: View {
    let label: String
    let value: Int
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 2) {
                Text(label)
                    .font(.system(size: 9, weight: .medium))
                    .textCase(.uppercase)
                    .foregroundStyle(.secondary)
                
                Text("\(value)")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(.primary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isSelected ? Color.accentColor.opacity(0.1) : Color(UIColor.secondarySystemBackground))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isSelected ? Color.accentColor : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    StatsBarView(
        stats: DashboardStats(total: 25, up: 20, down: 2, slow: 3, sslWarnings: 1),
        selectedFilter: .constant(.all)
    )
    .padding()
}
