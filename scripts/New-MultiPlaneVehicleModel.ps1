param(
  [Parameter(Mandatory = $true)]
  [string]$ManifestPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputDir,

  [string]$ModelFileName = "scene.gltf"
)

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = "Stop"

function Add-FloatArray {
  param(
    [System.Collections.Generic.List[byte]]$Buffer,
    [double[]]$Values
  )

  while (($Buffer.Count % 4) -ne 0) {
    $Buffer.Add(0)
  }

  $offset = $Buffer.Count
  foreach ($value in $Values) {
    [BitConverter]::GetBytes([single]$value) | ForEach-Object { $Buffer.Add($_) }
  }
  return @{
    Offset = $offset
    Length = $Buffer.Count - $offset
  }
}

function Add-UShortArray {
  param(
    [System.Collections.Generic.List[byte]]$Buffer,
    [int[]]$Values
  )

  while (($Buffer.Count % 4) -ne 0) {
    $Buffer.Add(0)
  }

  $offset = $Buffer.Count
  foreach ($value in $Values) {
    [BitConverter]::GetBytes([uint16]$value) | ForEach-Object { $Buffer.Add($_) }
  }
  return @{
    Offset = $offset
    Length = $Buffer.Count - $offset
  }
}

function New-QuaternionForYaw {
  param([double]$Degrees)
  $radians = $Degrees * [Math]::PI / 180.0
  $half = $radians / 2.0
  return @(
    0,
    [Math]::Sin($half),
    0,
    [Math]::Cos($half)
  )
}

$manifest = Get-Content $ManifestPath | ConvertFrom-Json
if (-not (Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
}

$buffer = [System.Collections.Generic.List[byte]]::new()
$bufferViews = @()
$accessors = @()
$meshes = @()
$nodes = @()
$materials = @()
$textures = @()
$images = @()
$samplers = @(@{})
$sceneNodes = @()

$planePositions = @(
  -0.5, -0.5, 0,
   0.5, -0.5, 0,
   0.5,  0.5, 0,
  -0.5,  0.5, 0
)
$planeUVs = @(
  0, 1,
  1, 1,
  1, 0,
  0, 0
)
$planeIndices = @(0, 1, 2, 0, 2, 3)

$positionsBlock = Add-FloatArray -Buffer $buffer -Values $planePositions
$uvBlock = Add-FloatArray -Buffer $buffer -Values $planeUVs
$indicesBlock = Add-UShortArray -Buffer $buffer -Values $planeIndices

$sharedPositionBufferViewIndex = 0
$sharedUvBufferViewIndex = 1
$sharedIndicesBufferViewIndex = 2

$bufferViews += @(
  @{ buffer = 0; byteOffset = $positionsBlock.Offset; byteLength = $positionsBlock.Length; target = 34962 },
  @{ buffer = 0; byteOffset = $uvBlock.Offset; byteLength = $uvBlock.Length; target = 34962 },
  @{ buffer = 0; byteOffset = $indicesBlock.Offset; byteLength = $indicesBlock.Length; target = 34963 }
)

$positionAccessorIndex = 0
$uvAccessorIndex = 1
$indexAccessorIndex = 2

$accessors += @(
  @{
    bufferView = $sharedPositionBufferViewIndex
    componentType = 5126
    count = 4
    type = "VEC3"
    min = @(-0.5, -0.5, 0)
    max = @(0.5, 0.5, 0)
  },
  @{
    bufferView = $sharedUvBufferViewIndex
    componentType = 5126
    count = 4
    type = "VEC2"
    min = @(0, 0)
    max = @(1, 1)
  },
  @{
    bufferView = $sharedIndicesBufferViewIndex
    componentType = 5123
    count = 6
    type = "SCALAR"
    min = @(0)
    max = @(3)
  }
)

$manifestDir = Split-Path -Parent $ManifestPath

for ($i = 0; $i -lt $manifest.views.Count; $i++) {
  $view = $manifest.views[$i]
  $imagePath = Join-Path $manifestDir $view.file
  $fileName = Split-Path -Leaf $imagePath
  $outputImagePath = Join-Path $OutputDir $fileName
  Copy-Item $imagePath $outputImagePath -Force

  $bitmap = [System.Drawing.Image]::FromFile($outputImagePath)
  $aspect = [Math]::Round($bitmap.Width / $bitmap.Height, 5)
  $bitmap.Dispose()

  $images += @{ uri = $fileName }
  $textures += @{ sampler = 0; source = $i }
  $materials += @{
    name = $view.label
    pbrMetallicRoughness = @{
      baseColorTexture = @{ index = $i }
      metallicFactor = 0
      roughnessFactor = 1
    }
    alphaMode = "BLEND"
    doubleSided = $true
  }

  $meshes += @{
    name = $view.label
    primitives = @(
      @{
        attributes = @{
          POSITION = $positionAccessorIndex
          TEXCOORD_0 = $uvAccessorIndex
        }
        indices = $indexAccessorIndex
        material = $i
      }
    )
  }

  $yaw = [double]$view.yaw
  $radius = [double]$view.radius
  $scale = [double]$view.scale
  $yawRadians = $yaw * [Math]::PI / 180.0
  $translation = @(
    [Math]::Round([Math]::Sin($yawRadians) * $radius, 6),
    [double]$view.yOffset,
    [Math]::Round([Math]::Cos($yawRadians) * $radius, 6)
  )

  $nodes += @{
    name = $view.label
    mesh = $i
    translation = $translation
    rotation = (New-QuaternionForYaw -Degrees $yaw)
    scale = @(
      [Math]::Round($aspect * $scale, 6),
      [Math]::Round($scale, 6),
      1
    )
  }

  $sceneNodes += $i
}

$binaryBuffer = [Convert]::ToBase64String($buffer.ToArray())
$gltf = @{
  asset = @{
    version = "2.0"
    generator = "Northstar Multi-Plane Vehicle Generator"
  }
  scene = 0
  scenes = @(
    @{
      name = $manifest.name
      nodes = $sceneNodes
    }
  )
  nodes = $nodes
  meshes = $meshes
  materials = $materials
  textures = $textures
  images = $images
  samplers = $samplers
  buffers = @(
    @{
      uri = "data:application/octet-stream;base64,$binaryBuffer"
      byteLength = $buffer.Count
    }
  )
  bufferViews = $bufferViews
  accessors = $accessors
}

$gltfPath = Join-Path $OutputDir $ModelFileName
$gltf | ConvertTo-Json -Depth 12 | Set-Content -Path $gltfPath -Encoding UTF8

Write-Output $gltfPath
