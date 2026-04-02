#!/bin/bash

# Create a backup
cp server.js server.js.backup

# Add OTP service import after the Expo import
sed -i '/import { Expo }/a import otpService from '\''./services/otpService.js'\'';' server.js

echo "✅ Added OTP import"
echo ""
echo "IMPORTANT: You need to manually update the following endpoints in server.js:"
echo "1. /auth/register endpoint - Add OTP verification"
echo "2. /auth/login endpoint - Check phone verification"
echo "3. Add job reporting endpoint"
echo "4. Add OTP and admin routes at the bottom"
echo ""
echo "Please open server.js in a code editor and make the changes manually."
echo "See UPDATES.md for the exact code to add."
