import SwiftUI

struct SiteRowView: View {
    let site: Site
    var onTap: (() -> Void)?
    
    var body: some View {
        Button(action: { onTap?() }) {
            HStack(spacing: 12) {
                StatusDot(status: site.lastStatus, isSlow: site.isSlow ?? false, size: 10)
                
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
