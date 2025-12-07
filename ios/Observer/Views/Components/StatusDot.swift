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
    
    private var shouldPulse: Bool {
        animated && (status == .down || isSlow)
    }
    
    var body: some View {
        ZStack {
            Circle()
                .fill(color)
                .frame(width: size, height: size)
            
            if shouldPulse {
                Circle()
                    .fill(color.opacity(0.5))
                    .frame(width: size, height: size)
                    .scaleEffect(1.5)
                    .opacity(0)
                    .animation(
                        .easeInOut(duration: 1.5)
                        .repeatForever(autoreverses: false),
                        value: UUID()
                    )
            }
        }
    }
}

#Preview {
    HStack(spacing: 20) {
        StatusDot(status: .up, isSlow: false)
        StatusDot(status: .down, isSlow: false)
        StatusDot(status: .up, isSlow: true)
        StatusDot(status: nil, isSlow: false)
    }
    .padding()
}
