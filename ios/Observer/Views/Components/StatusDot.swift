import SwiftUI

struct StatusDot: View {
    let status: SiteStatus?
    let isSlow: Bool
    var size: CGFloat = 10
    var animated: Bool = true
    
    private var color: Color {
        if status == .down { return .red }
        if isSlow { return .orange }
        if status == .up { return .green }
        return .gray
    }
    
    var body: some View {
        Circle()
            .fill(color)
            .frame(width: size, height: size)
    }
}
