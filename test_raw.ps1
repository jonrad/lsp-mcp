# Define the JSON-RPC request
$request = @{
    jsonrpc = "2.0"
    id = 1
    method = "tools/call"
    params = @{
        name = "textDocument_hover"
        arguments = @{
            textDocument = @{
                uri = "file:///C:/data/michele/openqa_xp/openQA/lib/OpenQA/Utils_test.pm"
            }
            position = @{
                line = 3
                character = 4
            }
        }
    }
} | ConvertTo-Json -Depth 10 -Compress

# Run the server with verbose to see errors
$output = echo $request | npx ts-node src/index.ts --verbose --config dev/mcp-cli/perlnavigator-with-settings-internal.json

# Extract only the JSON-RPC response (usually the last line starting with {)
$jsonString = $output | Where-Object { $_ -match "^{" } | Select-Object -Last 1

if ($jsonString) {
    try {
        $json = $jsonString | ConvertFrom-Json
        echo "`n--- FINAL PROMPT FOR LLM ---"
        echo $json.result.content[0].text
        echo "----------------------------"
    } catch {
        echo "Error: Failed to parse JSON string."
        echo $jsonString
    }
} else {
    echo "`n!!! ERROR: Could not find JSON response in output !!!"
    echo "--- FULL OUTPUT ---"
    $output | ForEach-Object { echo $_ }
    echo "-------------------"
}
