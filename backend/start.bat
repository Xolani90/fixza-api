@echo off
echo Setting JWT_SECRET...
set JWT_SECRET=fixza-super-secret-key-change-this-later
echo JWT_SECRET set to: %JWT_SECRET%
echo Starting server...
node server.js
pause