@echo off
set "PERL_INC=-I C:\data\michele\openqa_xp\openQA\lib -I C:\data\michele\openqa_xp\openQA\t\lib -I C:\data\michele\openqa_xp\openQA\external\os-autoinst-common\lib"
set "TEST_FILE=C:\data\michele\openqa_xp\openQA\lib\OpenQA\Utils_test.pm"

echo [DEBUG] Starting Manual Perl Check...
call perl %PERL_INC% -c "%TEST_FILE%"

echo.
echo [DEBUG] Starting Manual Critic Check...
call perlcritic --severity 5 "%TEST_FILE%"

echo.
echo [DEBUG] Starting MCP-CLI Call...
call npx @wong2/mcp-cli -c dev/mcp-cli/perlnavigator-with-settings.json call-tool perlnavigator:textDocument_hover --args "{\"textDocument\": {\"uri\": \"file:///C:/data/michele/openqa_xp/openQA/lib/OpenQA/Utils_test.pm\"}, \"position\": {\"line\": 3, \"character\": 4}}"

echo.
echo [DEBUG] Script Finished.
