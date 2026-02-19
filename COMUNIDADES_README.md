# 🎯 Sistema de Comunidades - GoLift

## ✅ O que foi implementado

### Frontend
- ✅ Página de Comunidades com 2 abas (Minhas / Explorar)
- ✅ Modal melhorado para criar comunidades
- ✅ Upload de imagem (seleção de galeria)
- ✅ Campos adicionais: País, Categoria, Privacidade, Línguas
- ✅ Página de detalhe com chat persistente
- ✅ Admin panel para verificação de comunidades
- ✅ Navegação atualizada

### Backend
- ✅ 9 endpoints de comunidades implementados
- ✅ Gestão de membros
- ✅ Chat com mensagens persistentes
- ✅ Admin endpoints (verificar/rejeitar)

### Base de Dados
- ✅ 3 tabelas SQL criadas
- ✅ Relacionamentos e foreign keys configuradas

---

## 📋 Próximas etapas

### 1. **Executar SQL na BD**
```bash
# Execute em tua BD:
- comunidades.sql (criar tabelas)
- update_comunidades.sql (se tabelas já existem)
```

### 2. **Implementar Upload de Imagem**
Atualmente o frontend seleciona imagem mas não faz upload para servidor. Opções:
- Usar Base64 (mais simples, lento)
- Usar AWS S3 / Firebase Storage (melhor prática)
- Endpoint POST no backend para receber files

### 3. **Validar API**
- Testar endpoints com Postman
- Verificar responses dos endpoints
- Testar com app real

### 4. **Melhorias futuras**
- Busca de comunidades
- Filtros por categoria/país
- Notificações de novas mensagens
- Edição de comunidades
- Bloqueio de utilizadores
- Moderadores de comunidades

---

## 📱 Componentes Criados

```
src/
├── app/(tabs)/
│   ├── communities.tsx          # Página principal
│   └── community/[id].tsx       # Detalhe + Chat
├── contexts/
│   └── CommunitiesContext.tsx   # Estado global
└── types/index.ts              # Types atualizados
```

## 🔌 Endpoints

### Públicos
- `GET /api/comunidades` - Listar verificadas
- `POST /api/comunidades` - Criar
- `POST /api/comunidades/:id/join` - Entrar
- `POST /api/comunidades/:id/leave` - Sair
- `GET/POST /api/comunidades/:id/mensagens` - Chat
- `GET /api/comunidades/:id/membros` - Membros

### Admin
- `GET /api/admin/comunidades/pendentes`
- `POST /api/admin/comunidades/:id/verificar`
- `POST /api/admin/comunidades/:id/rejeitar`

---

## 🎨 Campos Disponíveis

- **nome** - Nome da comunidade
- **descricao** - Descrição
- **imagem_url** - URL da imagem (implementar upload)
- **pais** - País da comunidade
- **linguas** - Línguas faladas
- **categoria** - Tipo de comunidade
- **privada** - Comunidade privada?
- **verificada** - Aprovada pelo admin?
