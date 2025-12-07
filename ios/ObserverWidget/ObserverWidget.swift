import WidgetKit
import SwiftUI

// MARK: - Widget Entry

struct SiteStatusEntry: TimelineEntry {
    let date: Date
    let totalSites: Int
    let downSites: Int
    let slowSites: Int
    let upSites: Int
    let downSiteNames: [String]
    let isPlaceholder: Bool
    
    static var placeholder: SiteStatusEntry {
        SiteStatusEntry(
            date: Date(),
            totalSites: 10,
            downSites: 1,
            slowSites: 2,
            upSites: 7,
            downSiteNames: ["example.com"],
            isPlaceholder: true
        )
    }
    
    static var empty: SiteStatusEntry {
        SiteStatusEntry(
            date: Date(),
            totalSites: 0,
            downSites: 0,
            slowSites: 0,
            upSites: 0,
            downSiteNames: [],
            isPlaceholder: false
        )
    }
}

// MARK: - Timeline Provider

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SiteStatusEntry {
        .placeholder
    }
    
    func getSnapshot(in context: Context, completion: @escaping (SiteStatusEntry) -> Void) {
        completion(.placeholder)
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<SiteStatusEntry>) -> Void) {
        // For now, return placeholder - actual implementation would fetch from shared App Group storage
        // In production, the main app would save site data to App Group UserDefaults
        let entry = SiteStatusEntry.placeholder
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 5, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

// MARK: - Widget Views

struct SmallWidgetView: View {
    let entry: SiteStatusEntry
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "eye.fill")
                    .font(.caption)
                Text("Observer")
                    .font(.caption)
                    .fontWeight(.semibold)
            }
            .foregroundStyle(.secondary)
            
            Spacer()
            
            if entry.downSites > 0 {
                HStack(spacing: 4) {
                    Circle()
                        .fill(.red)
                        .frame(width: 8, height: 8)
                    Text("\(entry.downSites) down")
                        .font(.headline)
                        .foregroundStyle(.red)
                }
            } else if entry.slowSites > 0 {
                HStack(spacing: 4) {
                    Circle()
                        .fill(.orange)
                        .frame(width: 8, height: 8)
                    Text("\(entry.slowSites) slow")
                        .font(.headline)
                        .foregroundStyle(.orange)
                }
            } else {
                HStack(spacing: 4) {
                    Circle()
                        .fill(.green)
                        .frame(width: 8, height: 8)
                    Text("All up")
                        .font(.headline)
                        .foregroundStyle(.green)
                }
            }
            
            Text("\(entry.totalSites) sites monitored")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding()
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

struct MediumWidgetView: View {
    let entry: SiteStatusEntry
    
    var body: some View {
        HStack(spacing: 16) {
            // Left: Status summary
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: "eye.fill")
                        .font(.caption)
                    Text("Observer")
                        .font(.caption)
                        .fontWeight(.semibold)
                }
                .foregroundStyle(.secondary)
                
                Spacer()
                
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 4) {
                        Circle().fill(.green).frame(width: 6, height: 6)
                        Text("\(entry.upSites) up")
                            .font(.caption)
                    }
                    HStack(spacing: 4) {
                        Circle().fill(.orange).frame(width: 6, height: 6)
                        Text("\(entry.slowSites) slow")
                            .font(.caption)
                    }
                    HStack(spacing: 4) {
                        Circle().fill(.red).frame(width: 6, height: 6)
                        Text("\(entry.downSites) down")
                            .font(.caption)
                    }
                }
                .foregroundStyle(.secondary)
            }
            
            Divider()
            
            // Right: Down sites list
            VStack(alignment: .leading, spacing: 4) {
                if entry.downSites == 0 && entry.slowSites == 0 {
                    Spacer()
                    HStack {
                        Spacer()
                        VStack(spacing: 4) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.title2)
                                .foregroundStyle(.green)
                            Text("All systems operational")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                    }
                    Spacer()
                } else {
                    Text("Issues")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(.secondary)
                    
                    ForEach(entry.downSiteNames.prefix(4), id: \.self) { name in
                        HStack(spacing: 4) {
                            Circle()
                                .fill(.red)
                                .frame(width: 6, height: 6)
                            Text(name)
                                .font(.caption)
                                .lineLimit(1)
                        }
                    }
                    
                    if entry.downSiteNames.count > 4 {
                        Text("+\(entry.downSiteNames.count - 4) more")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding()
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

// MARK: - Widget Configuration

struct ObserverWidget: Widget {
    let kind: String = "ObserverWidget"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            ObserverWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Site Status")
        .description("Monitor your sites at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct ObserverWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: SiteStatusEntry
    
    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(entry: entry)
        case .systemMedium:
            MediumWidgetView(entry: entry)
        default:
            SmallWidgetView(entry: entry)
        }
    }
}

// MARK: - Preview

#Preview(as: .systemSmall) {
    ObserverWidget()
} timeline: {
    SiteStatusEntry.placeholder
}

#Preview(as: .systemMedium) {
    ObserverWidget()
} timeline: {
    SiteStatusEntry.placeholder
    SiteStatusEntry(
        date: Date(),
        totalSites: 10,
        downSites: 0,
        slowSites: 0,
        upSites: 10,
        downSiteNames: [],
        isPlaceholder: false
    )
}
