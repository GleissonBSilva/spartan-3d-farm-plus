@echo off
chcp 65001 >nul
echo ======================================================
echo    RESTAURAÇÃO DO SPARTAN 3D FARM PLUS (CHECKPOINT)
echo ======================================================
echo.
echo Descartando alterações não salvas e restaurando para o checkpoint estável...
git reset --hard checkpoint-stable
git clean -fd

echo.
echo Restaurando arquivos de ambiente (.env e .env.local)...
if exist .env.backup (
    copy /y .env.backup .env >nul
    echo [OK] .env restaurado.
)
if exist .env.local.backup (
    copy /y .env.local.backup .env.local >nul
    echo [OK] .env.local restaurado.
)

echo.
echo ======================================================
echo  [SUCESSO] Código e configurações restaurados com êxito!
echo  Commit restaurado: %checkpoint-stable%
echo ======================================================
echo.
pause
