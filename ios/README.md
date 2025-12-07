# Observer iOS App

Native SwiftUI app for site monitoring.

## Setup Instructions

### 1. Create Xcode Project

1. Open Xcode
2. **File → New → Project**
3. Select **iOS → App**
4. Configure:
   - Product Name: `Observer`
   - Team: Your Apple Developer Team
   - Organization Identifier: `be.megavisor` (or your identifier)
   - Interface: **SwiftUI**
   - Language: **Swift**
   - Storage: None
   - ✅ Include Tests
5. Save in the `ios/` folder (replace the generated files)

### 2. Add Source Files

1. Delete the auto-generated `ContentView.swift` and `ObserverApp.swift`
2. In Xcode, right-click on the Observer folder → **Add Files to "Observer"**
3. Select all `.swift` files from:
   - `Observer/` (root files)
   - `Observer/Models/`
   - `Observer/Services/`
   - `Observer/Views/` (all subfolders)
   - `Observer/ViewModels/`
4. Make sure **"Copy items if needed"** is unchecked
5. Make sure **"Create groups"** is selected

### 3. Add Widget Extension

1. **File → New → Target**
2. Select **iOS → Widget Extension**
3. Configure:
   - Product Name: `ObserverWidget`
   - ❌ Uncheck "Include Configuration App Intent"
4. Delete the auto-generated files
5. Add the files from `ObserverWidget/` folder

### 4. Configure App Transport Security (Optional)

If testing with local/HTTP servers, add to `Info.plist`:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
```

### 5. Run the App

1. Select your target device/simulator
2. Press **⌘R** to build and run

## Project Structure

```
Observer/
├── ObserverApp.swift          # App entry point
├── ContentView.swift          # Root navigation (login vs dashboard)
├── Models/
│   ├── User.swift
│   ├── Workspace.swift
│   ├── Site.swift
│   └── APIModels.swift
├── Services/
│   ├── APIClient.swift        # HTTP networking
│   ├── AuthManager.swift      # Authentication state
│   └── SiteService.swift      # Site CRUD operations
├── Views/
│   ├── Login/
│   │   └── LoginView.swift
│   ├── Dashboard/
│   │   ├── DashboardView.swift
│   │   ├── SiteRowView.swift
│   │   └── StatsBarView.swift
│   ├── Sites/
│   │   ├── SiteDetailView.swift
│   │   └── AddSiteSheet.swift
│   └── Components/
│       └── StatusDot.swift
└── ViewModels/
    └── DashboardViewModel.swift
```

## Features

- ✅ Login with email/password
- ✅ Dashboard with site status
- ✅ Filter by status (All/Up/Down/Slow/SSL)
- ✅ Pull-to-refresh
- ✅ Auto-refresh every 30 seconds
- ✅ Add new sites
- ✅ Edit/delete sites
- ✅ Star/unstar sites
- ✅ Site details with SSL info
- ✅ Multiple workspace support
- ✅ Home screen widgets (small/medium)

## API Integration

The app connects to: `https://observer.megavisor.be/api`

Endpoints used:
- `POST /auth/login` - Login
- `POST /auth/logout` - Logout
- `GET /auth/me` - Get current user
- `GET /workspaces/:id/sites` - List sites
- `POST /workspaces/:id/sites` - Create site
- `PUT /workspaces/:id/sites/:id` - Update site
- `DELETE /workspaces/:id/sites/:id` - Delete site
- `POST /workspaces/:id/sites/:id/check` - Trigger check
- `POST /workspaces/:id/sites/:id/star` - Toggle star

## Future Enhancements

- [ ] Push notifications (requires APNs setup)
- [ ] Apple Watch app
- [ ] Offline caching
- [ ] Background refresh
- [ ] Biometric authentication
