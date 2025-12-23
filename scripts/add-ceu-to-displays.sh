#!/bin/bash

# This script adds CEU to all remaining display files
# Run with: bash scripts/add-ceu-to-displays.sh

echo "Adding CEU to display files..."

# File 1: app/display/metrics/page.tsx - Add filter case
sed -i '' "s/case 'visitors':/case 'visitors':\\
        return (item.score?.metrics.visitors || 0) >= 1;\\
      case 'ceu':/" app/display/metrics/page.tsx

# File 2: app/admin/teams/page.tsx - Add to categoryList
sed -i "" "s/'visitors'] as const/'visitors', 'ceu'] as const/" app/admin/teams/page.tsx

# File 3: app/display/team/[teamId]/page.tsx - Add to categories array
sed -i "" "s/'visitors'] as const/'visitors', 'ceu'] as const/" app/display/team/[teamId]/page.tsx

echo "✅ CEU added to display files"
echo "Run 'npm run build' to verify changes"
