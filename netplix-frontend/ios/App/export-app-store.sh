#!/usr/bin/env bash
# Next.js 빌드 → Capacitor 동기화 → Release 아카이브 → App Store Connect용 IPA 내보내기
# 필요: Xcode, CocoaPods, Apple Developer 계정(자동 서명), 로컬 키체인에 배포 서명 가능 상태
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
IOS_APP="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCHIVE="${IOS_APP}/build/App.xcarchive"
EXPORT_DIR="${IOS_APP}/output"

cd "$ROOT"

echo "==> npm run build"
npm run build

echo "==> npx cap sync ios"
npx cap sync ios

cd "$IOS_APP"

if [[ ! -d "Pods" ]]; then
  echo "==> pod install"
  pod install
fi

mkdir -p build output

echo "==> xcodebuild archive → ${ARCHIVE}"
xcodebuild \
  -workspace App.xcworkspace \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "${ARCHIVE}" \
  archive

echo "==> xcodebuild -exportArchive → ${EXPORT_DIR} (App Store Connect)"
rm -rf "${EXPORT_DIR:?}"/*
xcodebuild \
  -exportArchive \
  -archivePath "${ARCHIVE}" \
  -exportPath "${EXPORT_DIR}" \
  -exportOptionsPlist "${IOS_APP}/ExportOptions.plist"

echo ""
echo "완료. App Store 업로드용 IPA:"
echo "  ${EXPORT_DIR}/App.ipa"
echo ""
echo "Xcode Organizer에서 열려면: open \"${ARCHIVE}\""
