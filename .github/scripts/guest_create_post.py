from pathlib import Path

# Feed: keep create button visible to guests, preserve intent through login.
feed = Path('src/pages/Feed.tsx')
text = feed.read_text()

anchor = "const catOpts = Object.entries(postCategories).map(([v, d]) => ({ value: v, label: `${d.emoji} ${d.label}` }));\n"
if anchor not in text:
    raise SystemExit('Feed constants anchor not found')
text = text.replace(anchor, anchor + "const CREATE_POST_INTENT_KEY = 'nmb-after-login-action';\n", 1)

anchor = "  useEffect(() => { if (currentNeighborhood) setUserLocation({ lat: currentNeighborhood.latitude, lng: currentNeighborhood.longitude }); }, [currentNeighborhood]);\n"
if anchor not in text:
    raise SystemExit('Feed effect anchor not found')
addition = """  useEffect(() => {
    if (!isAuthenticated || !user) return;
    try {
      if (sessionStorage.getItem(CREATE_POST_INTENT_KEY) === 'create-post') {
        sessionStorage.removeItem(CREATE_POST_INTENT_KEY);
        setShowCreate(true);
      }
    } catch {}
  }, [isAuthenticated, user]);

  const openCreate = useCallback(() => {
    if (!isAuthenticated || !user) {
      try { sessionStorage.setItem(CREATE_POST_INTENT_KEY, 'create-post'); } catch {}
      toast('Entre ou crie uma conta para publicar um relato.', 'info');
      navigate('/login');
      return;
    }
    setShowCreate(true);
  }, [isAuthenticated, user, navigate, toast]);
"""
text = text.replace(anchor, anchor + addition, 1)

text = text.replace('onClick={() => setShowCreate(true)}><Sparkles', 'onClick={openCreate}><Sparkles', 1)

old_empty = "action={searchQuery ? { label: 'Limpar busca', onClick: () => setSearchQuery('') } : isAuthenticated ? { label: 'Criar relato', onClick: () => setShowCreate(true) } : { label: 'Entrar para participar', onClick: () => navigate('/login') }}"
new_empty = "action={searchQuery ? { label: 'Limpar busca', onClick: () => setSearchQuery('') } : { label: 'Criar relato', onClick: openCreate }}"
if old_empty not in text:
    raise SystemExit('Feed empty-state action anchor not found')
text = text.replace(old_empty, new_empty, 1)

old_fab = "{isAuthenticated && <button onClick={() => setShowCreate(true)} className=\"fixed bottom-28 md:bottom-8 right-6 z-30 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-xl shadow-emerald-600/30 hover:shadow-emerald-600/50 transition-all flex items-center justify-center active:scale-95 group\" aria-label=\"Criar novo relato\"><Plus className=\"w-6 h-6 group-hover:rotate-90 transition-transform duration-300\" /></button>}"
new_fab = "<button onClick={openCreate} className=\"fixed bottom-24 lg:bottom-8 right-4 sm:right-6 z-30 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-xl shadow-emerald-600/30 hover:shadow-emerald-600/50 transition-all flex items-center justify-center active:scale-95 group\" aria-label=\"Criar novo relato\" title={isAuthenticated ? 'Criar novo relato' : 'Entre ou crie uma conta para publicar'}><Plus className=\"w-6 h-6 group-hover:rotate-90 transition-transform duration-300\" /></button>"
if old_fab not in text:
    raise SystemExit('Feed floating create button anchor not found')
text = text.replace(old_fab, new_fab, 1)
feed.write_text(text)

# Login: return to Feed and continue the create-post intent after authentication.
login = Path('src/pages/Login.tsx')
text = login.read_text()

anchor = "const RECOVERY_MAX_AGE_MS = 20 * 60 * 1000;\n"
if anchor not in text:
    raise SystemExit('Login constants anchor not found')
text = text.replace(anchor, anchor + "const POST_LOGIN_ACTION_KEY = 'nmb-after-login-action';\n", 1)

anchor = "  const normalizedEmail = email.trim().toLowerCase();\n"
if anchor not in text:
    raise SystemExit('Login state anchor not found')
addition = """  const [postLoginAction] = useState(() => {
    try { return sessionStorage.getItem(POST_LOGIN_ACTION_KEY) || ''; } catch { return ''; }
  });
  const residentDestination = () => postLoginAction === 'create-post' ? '/' : '/perfil';
"""
text = text.replace(anchor, anchor + addition, 1)

old_signup_nav = "        nav(companyMode ? '/empresa' : '/perfil');"
new_signup_nav = "        nav(companyMode ? '/empresa' : residentDestination());"
if old_signup_nav not in text:
    raise SystemExit('Login signup destination anchor not found')
text = text.replace(old_signup_nav, new_signup_nav, 1)

old_login_nav = "      nav('/perfil');"
new_login_nav = "      nav(residentDestination());"
if old_login_nav not in text:
    raise SystemExit('Login resident destination anchor not found')
text = text.replace(old_login_nav, new_login_nav, 1)

old_subtitle = "          : 'Entre para participar da comunidade.';"
new_subtitle = "          : postLoginAction === 'create-post'\n            ? 'Entre ou crie uma conta para publicar seu relato.'\n            : 'Entre para participar da comunidade.';"
if old_subtitle not in text:
    raise SystemExit('Login subtitle anchor not found')
text = text.replace(old_subtitle, new_subtitle, 1)
login.write_text(text)

# Guide: show the + step to guests and explain authentication without hiding the affordance.
tour = Path('src/components/ProductExperience.tsx')
text = tour.read_text()

if "const ONBOARDING_KEY = 'nmb-onboarding-v5';" not in text:
    raise SystemExit('Onboarding version anchor not found')
text = text.replace("const ONBOARDING_KEY = 'nmb-onboarding-v5';", "const ONBOARDING_KEY = 'nmb-onboarding-v6';", 1)

replacements = {
    "description: 'Quer publicar um problema ou relato? Use este botão “+”.',": "description: 'O botão “+” fica sempre visível. Para publicar, basta entrar ou criar uma conta; se estiver deslogado, ele leva você direto ao acesso.',",
    "description: 'Feiras, campanhas, reuniões, esporte e outros eventos ficam aqui.',": "description: 'Feiras, campanhas, reuniões, esporte e outros eventos ficam aqui. Você pode explorar sem conta; para publicar ou participar, basta entrar ou criar uma conta.',",
    "description: 'Para publicar um problema ou relato, toque no botão “+”.',": "description: 'O “+” fica sempre disponível. Se você ainda não entrou, toque nele e faça login ou crie uma conta para publicar.',",
    "description: 'Feiras, campanhas, reuniões e outros eventos ficam aqui.',": "description: 'Feiras, campanhas, reuniões e outros eventos ficam aqui. Para publicar ou participar do Mural, entre ou crie uma conta.',",
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'Tour copy anchor not found: {old}')
    text = text.replace(old, new, 1)

old_filter = "      if (step.target === 'create-post' && !isAuthenticated) return false;\n"
if old_filter not in text:
    raise SystemExit('Tour create-post filter anchor not found')
text = text.replace(old_filter, '', 1)

tour.write_text(text)

# Remove the temporary patch files from the final source commit.
Path('.github/workflows/guest-create-post.yml').unlink(missing_ok=True)
Path('.github/scripts/guest_create_post.py').unlink(missing_ok=True)
