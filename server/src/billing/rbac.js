import { db } from '../db.js';

export function isSuperAdmin(auth) {
  return auth?.role === 'super_admin';
}

export function requireSuperAdmin(req, res, next) {
  if (!isSuperAdmin(req.auth)) {
    return res.status(403).json({ error: 'Platform administrator access only' });
  }
  next();
}

export async function staffRow(staffId) {
  return await db.prepare('SELECT * FROM staff WHERE staff_id = ?').get(staffId);
}

export async function resolveRequester(req) {
  const auth = req.auth || {};
  if (auth.role === 'super_admin') return { kind: 'super_admin', id: auth.id };
  if (auth.role === 'staff') {
    const row = await staffRow(auth.id);
    if (!row || row.is_active === 0) return { kind: 'staff_disabled', id: auth.id };
    return {
      kind: 'staff', id: row.staff_id, authority_id: row.authority_id,
      staff_role: row.staff_role || 'junior',
      isMayor: (row.staff_role || '') === 'mayor',
      isAdmin: (row.staff_role || '') === 'admin',
      row
    };
  }
  if (auth.role === 'citizen') return { kind: 'citizen', id: auth.id };
  return { kind: 'anon' };
}

export async function requireStaffActive(req, res, next) {
  try {
    const r = await resolveRequester(req);
    if (r.kind === 'super_admin') {
      req.requester = r;
      return next();
    }
    if (r.kind === 'staff_disabled') {
      return res.status(403).json({ error: 'Staff account is deactivated' });
    }
    if (r.kind !== 'staff') {
      return res.status(403).json({ error: 'Authority staff access only' });
    }
    req.requester = r;
    next();
  } catch (e) {
    next(e);
  }
}

/**
 * Tenant guard for LGI-scoped billing routes.
 * Super admin may pass ?authority_id= to act across LGIs (audited by callers).
 * Staff are pinned to their own authority from the DB row — client-supplied
 * organization ids are ignored for non-admins.
 *
 * Default allow is MAYOR ONLY (financial approver). User-administration
 * routes explicitly opt admin back in via { allow: ['mayor','admin'] }.
 */
export function requireOrgAccess({ allow = ['mayor'] } = {}) {
  return async (req, res, next) => {
    try {
      const r = await resolveRequester(req);
      if (r.kind === 'super_admin') {
        const aid = parseInt(req.query.authority_id || req.body?.authority_id) || null;
        req.org = { authority_id: aid, role: 'super_admin', requester: r };
        return next();
      }
      if (r.kind === 'staff_disabled') {
        return res.status(403).json({ error: 'Staff account is deactivated' });
      }
      if (r.kind !== 'staff') {
        return res.status(403).json({ error: 'Authority staff access only' });
      }
      if (!allow.includes(r.staff_role)) {
        return res.status(403).json({ error: 'Mayor/Chairman or LGI admin access only' });
      }
      req.org = { authority_id: r.authority_id, role: r.staff_role, requester: r };
      next();
    } catch (e) {
      next(e);
    }
  };
}

export async function orgStaffIds(authorityId, roles) {
  const rows = await db.prepare(
    `SELECT staff_id FROM staff WHERE authority_id = ? AND is_active = 1 AND staff_role IN (${roles.map(() => '?').join(',')})`
  ).all(authorityId, ...roles);
  return rows.map((r) => r.staff_id);
}

export async function superAdminUserIds() {
  return (await db.prepare(`SELECT user_id FROM users WHERE role = 'super_admin'`).all()).map((r) => r.user_id);
}
