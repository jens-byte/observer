import SwiftUI

struct LoginView: View {
    @ObservedObject var authManager = AuthManager.shared
    @State private var email = ""
    @State private var password = ""
    @State private var isLoggingIn = false
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 32) {
                Spacer()
                
                // Logo
                VStack(spacing: 12) {
                    ZStack {
                        Circle()
                            .fill(Color.primary)
                            .frame(width: 80, height: 80)
                        Circle()
                            .fill(Color(UIColor.systemBackground))
                            .frame(width: 30, height: 30)
                    }
                    
                    Text("Observer")
                        .font(.largeTitle)
                        .fontWeight(.semibold)
                    
                    Text("Site Monitoring")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                // Form
                VStack(spacing: 16) {
                    TextField("Email", text: $email)
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.emailAddress)
                        .autocapitalization(.none)
                        .keyboardType(.emailAddress)
                    
                    SecureField("Password", text: $password)
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.password)
                    
                    if let error = authManager.error {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.red)
                            .multilineTextAlignment(.center)
                    }
                    
                    Button {
                        Task {
                            isLoggingIn = true
                            await authManager.login(email: email, password: password)
                            isLoggingIn = false
                        }
                    } label: {
                        HStack {
                            if isLoggingIn {
                                ProgressView()
                                    .tint(.white)
                            }
                            Text("Sign In")
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.accentColor)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .disabled(email.isEmpty || password.isEmpty || isLoggingIn)
                }
                .padding(.horizontal)
                
                Spacer()
            }
            .padding()
        }
    }
}
