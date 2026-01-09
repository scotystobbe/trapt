# Apple Music API Setup Guide

## Step 1: Create a Private Key (Already Done ✅)
You've registered your Media identifier. Great!

## Step 2: Create a Private Key

1. Go to [Apple Developer Console](https://developer.apple.com/account/resources/authkeys/list)
2. Click the **"+"** button to create a new key
3. **Key Name**: Give it a name (e.g., "Trapt Apple Music Key")
4. **Enable Services**: Check **"Media Services"** (includes MusicKit)
5. Click **"Configure"** next to Media Services
6. Select your Media Identifier from the dropdown
7. Click **"Save"**
8. Click **"Continue"** then **"Register"**
9. **IMPORTANT**: Download the `.p8` private key file - you can only download it once!
10. Note your **Key ID** (shown after creation)

## Step 3: Get Your Team ID

1. Go to [Apple Developer Membership](https://developer.apple.com/account)
2. Your **Team ID** is displayed at the top right (10-character string)

## Step 4: Generate Developer Token

You have two options:

### Option A: Use the Helper Script (Recommended)

I'll create a helper script that generates the developer token for you. You'll need to:

1. Install the required package:
   ```bash
   npm install jsonwebtoken
   ```

2. Create a file `.env` with:
   ```env
   APPLE_MUSIC_TEAM_ID="your-team-id"
   APPLE_MUSIC_KEY_ID="your-key-id"
   APPLE_MUSIC_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
   ```

3. Run the helper script (I'll create this for you)

### Option B: Manual Generation

You can generate the developer token manually using a JWT library. The token needs:
- **Algorithm**: ES256
- **Header**: `{ "alg": "ES256", "kid": "YOUR_KEY_ID" }`
- **Payload**: 
  ```json
  {
    "iss": "YOUR_TEAM_ID",
    "iat": current_timestamp,
    "exp": current_timestamp + 15777000
  }
  ```
- **Sign with**: Your `.p8` private key

## Step 5: User Authentication

For accessing user playlists, you need a **user token**. This requires:

1. **Developer Token** (from Step 4) - stored as environment variable
2. **User Token** - obtained via OAuth flow

The user token is obtained when a user authorizes your app to access their Apple Music library. This is typically done through:
- MusicKit JS (for web apps)
- MusicKit framework (for iOS/macOS apps)
- Or a custom OAuth implementation

## Current Implementation

Right now, the app expects users to manually provide their user token. For a production setup, you'd want to:

1. Store the developer token as an environment variable
2. Implement OAuth flow to get user tokens automatically
3. Store user tokens securely (similar to how Spotify tokens are handled)

## Quick Start (For Testing)

For now, to test the feature:

1. Generate a developer token (see Step 4)
2. Add it to your `.env` file as `APPLE_MUSIC_DEVELOPER_TOKEN`
3. Users will need to get their own user token (can be done via browser console with MusicKit JS, or we can add a helper endpoint)

Would you like me to:
1. Create a helper script to generate the developer token?
2. Add an endpoint to generate developer tokens server-side?
3. Implement a full OAuth flow for user authentication?

