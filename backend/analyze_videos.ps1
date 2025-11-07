# Video Compatibility Analyzer
# Analyzes video files in InputVideos folder for compatibility

$dir = 'InputVideos'
$files = @(
    'Adayar_C1-8.23Pm to 8.35.mp4',
    'Adayar_C2-8.23Pm to 8.35.mp4',
    'Adayar_C3-8.23Pm to 8.35.mp4',
    'Adayar_C4-8.23Pm to 8.35.mp4'
)

Write-Host "=== Video Compatibility Analyzer ===" -ForegroundColor Cyan
Write-Host ""

# Step 0 - Verify tools
Write-Host "Step 0 - Verifying FFmpeg/FFprobe..." -ForegroundColor Yellow
try {
    $ffmpegVer = (ffmpeg -version 2>&1 | Select-Object -First 1)
    Write-Host "FFmpeg: $ffmpegVer" -ForegroundColor Green
} catch {
    Write-Host "FFmpeg not found!" -ForegroundColor Red
    exit 1
}
try {
    $ffprobeVer = (ffprobe -version 2>&1 | Select-Object -First 1)
    Write-Host "FFprobe: $ffprobeVer" -ForegroundColor Green
} catch {
    Write-Host "FFprobe not found!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Function to get core parameters
function Get-CoreParams {
    param([string]$path, [string]$filename)
    
    Write-Host "Processing: $filename" -ForegroundColor Cyan
    
    # Get core stream parameters
    $jsonOutput = ffprobe -v error -select_streams v:0 -show_entries `
        stream=index,codec_name,codec_tag_string,profile,level,width,height,pix_fmt,`
        r_frame_rate,avg_frame_rate,field_order,color_range,color_space,color_primaries,color_transfer,`
        sample_aspect_ratio,display_aspect_ratio,bit_rate `
        -of json "$path" 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "FFprobe failed for $filename"
        Write-Host $jsonOutput
        return $null
    }
    
    try {
        $json = $jsonOutput | ConvertFrom-Json
        
        if (-not $json.streams -or $json.streams.Count -eq 0) {
            Write-Warning "No video stream found in $filename"
            return $null
        }
        
        $s = $json.streams[0]
        
        # Get GOP spacing
        $csvOutput = ffprobe -v error -select_streams v:0 -show_frames `
            -show_entries frame=pkt_pts_time,pict_type -of csv=print_section=0 "$path" 2>&1
        
        $iTimes = @()
        foreach ($line in $csvOutput) {
            if ($line -match ',I$') {
                $parts = $line.Split(',')
                if ($parts.Count -ge 2) {
                    $timeStr = $parts[1]
                    try {
                        $time = [double]$timeStr
                        $iTimes += $time
                    } catch {
                        # Skip invalid time
                    }
                }
            }
        }
        
        $gopMean = $null
        if ($iTimes.Count -gt 1) {
            $deltas = @()
            for ($i = 1; $i -lt $iTimes.Count; $i++) {
                $deltas += ($iTimes[$i] - $iTimes[$i-1])
            }
            if ($deltas.Count -gt 0) {
                $gopMean = [Math]::Round(($deltas | Measure-Object -Average).Average, 3)
            }
        }
        
        return [PSCustomObject]@{
            File = $filename
            codec_name = $s.codec_name
            codec_tag_string = $s.codec_tag_string
            profile = $s.profile
            level = $s.level
            width = $s.width
            height = $s.height
            pix_fmt = $s.pix_fmt
            r_frame_rate = $s.r_frame_rate
            avg_frame_rate = $s.avg_frame_rate
            field_order = $s.field_order
            color_range = $s.color_range
            color_space = $s.color_space
            color_primaries = $s.color_primaries
            color_transfer = $s.color_transfer
            sample_aspect_ratio = $s.sample_aspect_ratio
            display_aspect_ratio = $s.display_aspect_ratio
            bit_rate = $s.bit_rate
            GOP_mean_seconds = $gopMean
        }
    } catch {
        Write-Warning "Failed to parse JSON for $filename : $_"
        return $null
    }
}

# Step 1 - Analyze all files
Write-Host "Step 1 - Analyzing core parameters..." -ForegroundColor Yellow
$results = @()
foreach ($f in $files) {
    $p = Join-Path $dir $f
    if (-not (Test-Path $p)) {
        Write-Warning "Missing file: $p"
        continue
    }
    $result = Get-CoreParams -path $p -filename $f
    if ($result) {
        $results += $result
    }
    Write-Host ""
}

if ($results.Count -eq 0) {
    Write-Host "No valid results found!" -ForegroundColor Red
    exit 1
}

# Display detailed results
Write-Host "=== Core Parameters Per File ===" -ForegroundColor Cyan
$results | Format-Table -AutoSize

# Step 2 - Compare compatibility
Write-Host ""
Write-Host "=== Compatibility Check ===" -ForegroundColor Yellow

$keysToMatch = @(
    'codec_name', 'profile', 'level', 'width', 'height', 'pix_fmt',
    'r_frame_rate', 'avg_frame_rate', 'field_order',
    'color_range', 'color_space', 'color_primaries', 'color_transfer',
    'sample_aspect_ratio'
)

$mismatches = @()
foreach ($k in $keysToMatch) {
    $vals = $results | ForEach-Object { $_.$k } | Where-Object { $_ -ne $null } | Sort-Object -Unique
    if ($vals.Count -gt 1) {
        $mismatches += [PSCustomObject]@{
            Field = $k
            Values = ($vals -join ' | ')
        }
    }
}

Write-Host ""
if ($mismatches.Count -eq 0) {
    Write-Host "✓ Compatibility: PASS - All core parameters match across files!" -ForegroundColor Green
} else {
    Write-Host "✗ Compatibility: FAIL - Found mismatches:" -ForegroundColor Red
    $mismatches | Format-Table -AutoSize
}

# Step 3 - Frame rate summary
Write-Host ""
Write-Host "=== Frame Rate Summary ===" -ForegroundColor Cyan
$results | Select-Object File, r_frame_rate, avg_frame_rate | Format-Table -AutoSize

# Step 4 - GOP spacing summary
Write-Host ""
Write-Host "=== GOP Spacing Summary ===" -ForegroundColor Cyan
$gopResults = $results | Select-Object File, GOP_mean_seconds | Where-Object { $_.GOP_mean_seconds -ne $null }
if ($gopResults.Count -gt 0) {
    $gopResults | Format-Table -AutoSize
    Write-Host "Note: GOP mean ~1.0s is ideal for snappy cuts. Larger values still work but snap less tightly." -ForegroundColor Gray
} else {
    Write-Host "Could not calculate GOP spacing for any files." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Analysis Complete ===" -ForegroundColor Cyan

