import { useState } from 'react'
import { Avatar, Box, Button, Chip, Divider, ListItemText, Menu, MenuItem, Typography } from '@mui/material'
import LogoutIcon from '@mui/icons-material/Logout'
import { roleLabel, useSession } from '@/entities/session'
import { errorMessage } from '@/shared/api'
import { useNotify } from '@/shared/ui'

/** Меню пользователя в шапке: имя, роль и кнопка «Выйти». */
export default function UserMenu() {
  const { user, logout } = useSession()
  const notify = useNotify()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  if (!user) return null

  const doLogout = async () => {
    setAnchor(null)
    try {
      await logout()
    } catch (e) {
      notify(errorMessage(e), 'error')
    }
  }

  return (
    <>
      <Button color="inherit" onClick={(e) => setAnchor(e.currentTarget)} aria-haspopup="menu" aria-label="Меню пользователя" data-testid="user-menu">
        <Avatar sx={{ width: 28, height: 28, mr: { xs: 0, sm: 1 }, bgcolor: 'secondary.main', fontSize: 14 }}>
          {user.full_name.charAt(0).toUpperCase()}
        </Avatar>
        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{user.full_name}</Box>
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <Box sx={{ px: 2, py: 1, maxWidth: 280 }}>
          <Typography sx={{ fontWeight: 600 }} noWrap>{user.full_name}</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>{user.email}</Typography>
          <Chip size="small" label={roleLabel[user.role]} sx={{ mt: 0.5 }} data-testid="user-role" />
        </Box>
        <Divider />
        <MenuItem onClick={doLogout}>
          <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
          <ListItemText>Выйти</ListItemText>
        </MenuItem>
      </Menu>
    </>
  )
}
