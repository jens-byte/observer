import SwiftUI

struct SiteRowView: View {
    let site: Site
    var onTap: (() -> Void)?
    
    var body: some View {
        Button(action: { onTap?() }) {
            HStack(spacing: 12) {
                StatusDot(
                    status: site.lastStatus,
                    isSlow: site.isSlow ?? false,
                    size: 10
                )
                
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        if site.isStarred {
                            Image(systemName: "star.fill")
                                .font(.system(size: 10))
                                .foregroundStyle(.yellow)
                        }
                        Text(site.name)
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundStyle(.primary)
                    }
                    
                    Text(site.url)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 2) {
                    if let responseTime = site.lastResponseTime {
                        Text("\(responseTime)ms")
                            .font(.caption)
                            .foregroundStyle(site.isSlow == true ? .orange : .secondary)
                    }
                    
                    Text(site.lastCheckedAgo)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 12)
            .background(Color(UIColor.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }
}

// Compact version for switchboard
struct SiteCompactRow: View {
    let site: Site
    
    var body: some View {
        HStack(spacing: 6) {
            StatusDot(
                status: site.lastStatus,
                isSlow: site.isSlow ?? false,
                size: 8,
                animated: false
            )
            
            Text(site.name)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
    }
}

#Preview {
    VStack {
        SiteRowView(site: Site(
            id: 1,
            workspaceId: 1,
            name: "Example Site",
            url: "https://example.com",
            checkInterval: 5,
            isActive: true,
            isStarred: true,
            isSla: false,
            license: nil,
            lastStatus: .up,
            lastResponseTime: 245,
            lastCheckedAt: ISO8601DateFormatter().string(from: Date()),
            consecutiveFailures: 0,
            confirmedDownAt: nil,
            downNotified: false,
            createdAt: "",
            isSlow: false,
            uptime: 99.9,
            responseHistory: [],
            sslDaysRemaining: 45,
            sslValidTo: nil,
            nameservers: nil,
            ipAddress: nil,
            cmsName: nil,
            cmsVersion: nil
        ))
        
        SiteCompactRow(site: Site(
            id: 1,
            workspaceId: 1,
            name: "Another Site",
            url: "https://another.com",
            checkInterval: 5,
            isActive: true,
            isStarred: false,
            isSla: false,
            license: nil,
            lastStatus: .down,
            lastResponseTime: nil,
            lastCheckedAt: nil,
            consecutiveFailures: 3,
            confirmedDownAt: nil,
            downNotified: false,
            createdAt: "",
            isSlow: false,
            uptime: nil,
            responseHistory: [],
            sslDaysRemaining: nil,
            sslValidTo: nil,
            nameservers: nil,
            ipAddress: nil,
            cmsName: nil,
            cmsVersion: nil
        ))
    }
    .padding()
}
