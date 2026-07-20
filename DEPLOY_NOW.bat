@echo off
echo ========================================
echo DEPLOYING CRITICAL INPUT FREEZE FIXES
echo ========================================
echo.

cd frontend

echo [1/5] Checking for TypeScript errors...
npx tsc --noEmit
if %errorlevel% neq 0 (
    echo ERROR: TypeScript errors found!
    pause
    exit /b 1
)
echo ✅ TypeScript OK

echo.
echo [2/5] Building frontend...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)
echo ✅ Build successful

cd ..

echo.
echo [3/5] Staging all changes...
git add .
echo ✅ Files staged

echo.
echo [4/5] Committing changes...
git commit -m "CRITICAL FIX: Resolve mobile input freeze issue

Root causes fixed:
1. Canvas touchAction blocking all touch events globally
2. Full-screen overlays without explicit pointerEvents
3. React.StrictMode causing double-render issues  
4. Missing iOS viewport controls and input handling
5. No global pointer-events rules for form elements
6. Mac-input class missing touch/pointer support

Changes:
- frontend/src/components/canvas/CanvasPanel.tsx: Conditional touchAction
- frontend/src/components/game/GameScreen.tsx: pointerEvents on all overlays
- frontend/src/main.tsx: Removed StrictMode
- frontend/index.html: Added viewport controls and critical CSS
- frontend/src/styles.css: Global input interactivity rules
- frontend/src/components/auth/AuthScreen.tsx: Google button fix
- Added diagnostic test page: public/test-input.html

This fixes the catastrophic input freeze bug affecting all textboxes site-wide."

if %errorlevel% neq 0 (
    echo ERROR: Commit failed!
    pause
    exit /b 1
)
echo ✅ Changes committed

echo.
echo [5/5] Pushing to GitHub...
git push origin main
if %errorlevel% neq 0 (
    echo ERROR: Push failed!
    pause
    exit /b 1
)
echo ✅ Pushed to GitHub

echo.
echo ========================================
echo ✅ DEPLOYMENT COMPLETE!
echo ========================================
echo.
echo Vercel will auto-deploy from GitHub.
echo.
echo NEXT STEPS:
echo 1. Wait 2-3 minutes for Vercel deployment
echo 2. Test diagnostic page: https://your-domain.vercel.app/test-input.html
echo 3. Test main app on ACTUAL mobile device
echo 4. Check browser console for errors if issue persists
echo.
pause
