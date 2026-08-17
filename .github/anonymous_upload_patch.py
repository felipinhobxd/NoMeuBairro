from pathlib import Path

p = Path('src/contexts/DataContext.tsx')
text = p.read_text()
start = text.index("  const addAnonymousPost = useCallback")
end = text.index("  const supportPost = useCallback", start)
replacement = '''  const addAnonymousPost = useCallback(async (data: { tipo: string; description: string; location: string; imageUrl?: string; latitude?: number; longitude?: number }) => {
    const editToken = createAnonymousEditToken();
    const { data: result, error } = await supabase.functions.invoke('anonymous-post-control', {
      body: {
        action: 'create',
        tipo: data.tipo,
        description: data.description,
        location: data.location || 'Local Privado',
        imageData: data.imageUrl || null,
        latitude: data.latitude,
        longitude: data.longitude,
        editToken,
      },
    });
    if (error || !result?.ok || !result?.postId) {
      return { error: { message: result?.error || error?.message || 'Não foi possível enviar a denúncia.' } };
    }
    saveAnonControl(result.postId, editToken);
    const { data: row } = await supabase.from('posts').select('id,category,status,title,description,image_url,location,neighborhood,locality,location_precision,latitude,longitude,created_at,updated_at,comments_count').eq('id', result.postId).maybeSingle();
    if (row) {
      const nextPost = mapPost({ ...row, author_id: null, is_anonymous: true, post_supports: [{ count: 0 }] });
      postsLoadedRef.current = true;
      setPosts(prev => [nextPost, ...prev.filter(post => post.id !== nextPost.id)].slice(0, POST_LIMIT));
    }
    return { error: null };
  }, [saveAnonControl]);

'''
text = text[:start] + replacement + text[end:]
p.write_text(text)

Path('.github/workflows/anonymous-upload-hardening.yml').unlink(missing_ok=True)
Path('.github/anonymous_upload_patch.py').unlink(missing_ok=True)
