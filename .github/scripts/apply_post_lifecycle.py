from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly 1 match, found {count}')
    return text.replace(old, new, 1)


path = 'src/utils/pushNotifications.ts'
text = read(path)
text = replace_once(
    text,
    "import { supabase } from './supabase';\n",
    "import { supabase } from './supabase';\n\n// VAPID public keys are designed to be distributed to browsers. Only the\n// matching private key remains encrypted in Supabase Vault.\nconst VAPID_PUBLIC_KEY = 'BMLCZQX5oPc_pvsgjPOVPXUIXVvG4zRYEwccZCsKNouMlVOXOFOBNMuBjciEkLIcy4UxDyAE_dLOZTWEgV7r9I0';\n",
    'VAPID public key constant',
)
text = replace_once(
    text,
    "  if (!subscription) {\n    const { data: publicKey, error } = await supabase.rpc('get_push_public_key');\n    if (error || !publicKey) throw new Error(error?.message || 'Chave pública de notificações indisponível.');\n    subscription = await registration.pushManager.subscribe({\n      userVisibleOnly: true,\n      applicationServerKey: base64UrlToUint8Array(String(publicKey)),\n    });\n  }",
    "  if (!subscription) {\n    subscription = await registration.pushManager.subscribe({\n      userVisibleOnly: true,\n      applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY),\n    });\n  }",
    'remove public key RPC',
)
write(path, text)

migration = r'''-- Reduce externally executable SECURITY DEFINER surface.
-- Weekly summary reads only sources already intended for public aggregate display.
alter function public.get_neighborhood_weekly_summary(text, text) security invoker;

-- Browsers receive the VAPID public key from the frontend bundle. The private
-- VAPID key and dispatcher token remain encrypted in Vault and available only
-- through the service-role-only get_push_server_config RPC.
revoke all on function public.get_push_public_key() from public, anon, authenticated;
drop function if exists public.get_push_public_key();
'''
write('database/20260817_reduce_public_security_definer_surface.sql', migration)

print('Web Push privilege surface reduced successfully.')
