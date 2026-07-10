import { and, asc, count, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  outlets,
  permissions,
  productItems,
  registers,
  rolePermissions,
  roles,
  sales,
  shifts,
  userOutlets,
  userRoles,
  users,
} from "@/db/schema";

function appendToMap<T>(map: Map<string, T[]>, key: string, value: T) {
  const currentValues = map.get(key) ?? [];

  currentValues.push(value);
  map.set(key, currentValues);
}

export async function getAdministrationOverview(organizationId: string) {
  const [userStatusRows, activeRoleRows, activeOutletRows, activeRegisterRows] =
    await Promise.all([
      db
        .select({
          status: users.status,
          total: count(),
        })
        .from(users)
        .where(eq(users.organizationId, organizationId))
        .groupBy(users.status),

      db
        .select({
          total: count(),
        })
        .from(roles)
        .where(
          and(
            eq(roles.organizationId, organizationId),
            eq(roles.isActive, true),
          ),
        ),

      db
        .select({
          total: count(),
        })
        .from(outlets)
        .where(
          and(
            eq(outlets.organizationId, organizationId),
            eq(outlets.isActive, true),
          ),
        ),

      db
        .select({
          total: count(),
        })
        .from(registers)
        .innerJoin(outlets, eq(registers.outletId, outlets.id))
        .where(
          and(
            eq(outlets.organizationId, organizationId),
            eq(registers.isActive, true),
          ),
        ),
    ]);

  const getUserCount = (status: "active" | "inactive" | "suspended") =>
    Number(userStatusRows.find((row) => row.status === status)?.total ?? 0);

  return {
    totalUsers: userStatusRows.reduce(
      (total, row) => total + Number(row.total),
      0,
    ),

    activeUsers: getUserCount("active"),

    inactiveUsers: getUserCount("inactive"),

    suspendedUsers: getUserCount("suspended"),

    activeRoles: Number(activeRoleRows[0]?.total ?? 0),

    activeOutlets: Number(activeOutletRows[0]?.total ?? 0),

    activeRegisters: Number(activeRegisterRows[0]?.total ?? 0),
  };
}

export async function getStaffList(organizationId: string) {
  const staffRows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      username: users.username,
      email: users.email,
      phone: users.phone,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.organizationId, organizationId))
    .orderBy(asc(users.fullName));

  const userIds = staffRows.map((staff) => staff.id);

  if (userIds.length === 0) {
    return staffRows.map((staff) => ({
      ...staff,
      roles: [],
      outlets: [],
    }));
  }

  const [roleAssignmentRows, outletAssignmentRows] = await Promise.all([
    db
      .select({
        userId: userRoles.userId,
        id: roles.id,
        code: roles.code,
        name: roles.name,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(
          inArray(userRoles.userId, userIds),
          eq(roles.organizationId, organizationId),
        ),
      )
      .orderBy(asc(roles.name)),

    db
      .select({
        userId: userOutlets.userId,
        id: outlets.id,
        code: outlets.code,
        name: outlets.name,
        isPrimary: userOutlets.isPrimary,
      })
      .from(userOutlets)
      .innerJoin(outlets, eq(userOutlets.outletId, outlets.id))
      .where(
        and(
          inArray(userOutlets.userId, userIds),
          eq(outlets.organizationId, organizationId),
        ),
      )
      .orderBy(asc(outlets.name)),
  ]);

  const rolesByUser = new Map<
    string,
    Array<{
      id: string;
      code: string;
      name: string;
    }>
  >();

  for (const row of roleAssignmentRows) {
    appendToMap(rolesByUser, row.userId, {
      id: row.id,
      code: row.code,
      name: row.name,
    });
  }

  const outletsByUser = new Map<
    string,
    Array<{
      id: string;
      code: string;
      name: string;
      isPrimary: boolean;
    }>
  >();

  for (const row of outletAssignmentRows) {
    appendToMap(outletsByUser, row.userId, {
      id: row.id,
      code: row.code,
      name: row.name,
      isPrimary: row.isPrimary,
    });
  }

  return staffRows.map((staff) => ({
    ...staff,
    roles: rolesByUser.get(staff.id) ?? [],
    outlets: outletsByUser.get(staff.id) ?? [],
  }));
}

export async function getRolesWithPermissions(organizationId: string) {
  const roleRows = await db
    .select({
      id: roles.id,
      code: roles.code,
      name: roles.name,
      description: roles.description,
      isSystem: roles.isSystem,
      isActive: roles.isActive,
      createdAt: roles.createdAt,
    })
    .from(roles)
    .where(eq(roles.organizationId, organizationId))
    .orderBy(asc(roles.name));

  const roleIds = roleRows.map((role) => role.id);

  if (roleIds.length === 0) {
    return [];
  }

  const [permissionRows, assignmentRows] = await Promise.all([
    db
      .select({
        roleId: rolePermissions.roleId,
        id: permissions.id,
        code: permissions.code,
        name: permissions.name,
        module: permissions.module,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(inArray(rolePermissions.roleId, roleIds))
      .orderBy(asc(permissions.module), asc(permissions.name)),

    db
      .select({
        roleId: userRoles.roleId,
        userId: userRoles.userId,
      })
      .from(userRoles)
      .where(inArray(userRoles.roleId, roleIds)),
  ]);

  const permissionsByRole = new Map<
    string,
    Array<{
      id: string;
      code: string;
      name: string;
      module: string;
    }>
  >();

  for (const row of permissionRows) {
    appendToMap(permissionsByRole, row.roleId, {
      id: row.id,
      code: row.code,
      name: row.name,
      module: row.module,
    });
  }

  const userIdsByRole = new Map<string, Set<string>>();

  for (const row of assignmentRows) {
    const currentUsers = userIdsByRole.get(row.roleId) ?? new Set<string>();

    currentUsers.add(row.userId);

    userIdsByRole.set(row.roleId, currentUsers);
  }

  return roleRows.map((role) => ({
    ...role,

    permissions: permissionsByRole.get(role.id) ?? [],

    userCount: userIdsByRole.get(role.id)?.size ?? 0,
  }));
}

export async function getOutletsWithRegisters(organizationId: string) {
  const outletRows = await db
    .select({
      id: outlets.id,
      code: outlets.code,
      name: outlets.name,
      address: outlets.address,
      phone: outlets.phone,
      googleMapsEmbedUrl: outlets.googleMapsEmbedUrl,
      isActive: outlets.isActive,
      createdAt: outlets.createdAt,
    })
    .from(outlets)
    .where(eq(outlets.organizationId, organizationId))
    .orderBy(asc(outlets.name));

  const outletIds = outletRows.map((outlet) => outlet.id);

  if (outletIds.length === 0) {
    return [];
  }

  const registerRows = await db
    .select({
      id: registers.id,
      outletId: registers.outletId,
      code: registers.code,
      name: registers.name,
      isHardwareHub: registers.isHardwareHub,
      isActive: registers.isActive,
      createdAt: registers.createdAt,
    })
    .from(registers)
    .where(inArray(registers.outletId, outletIds))
    .orderBy(asc(registers.name));

  const registersByOutlet = new Map<
    string,
    Array<{
      id: string;
      code: string;
      name: string;
      isHardwareHub: boolean;
      isActive: boolean;
      createdAt: Date;
    }>
  >();

  for (const register of registerRows) {
    appendToMap(registersByOutlet, register.outletId, {
      id: register.id,
      code: register.code,
      name: register.name,
      isHardwareHub: register.isHardwareHub,
      isActive: register.isActive,
      createdAt: register.createdAt,
    });
  }

  return outletRows.map((outlet) => ({
    ...outlet,

    registers: registersByOutlet.get(outlet.id) ?? [],
  }));
}
export async function getStaffManagementOptions(organizationId: string) {
  const [roleRows, outletRows] = await Promise.all([
    db
      .select({
        id: roles.id,
        code: roles.code,
        name: roles.name,
        description: roles.description,
      })
      .from(roles)
      .where(
        and(eq(roles.organizationId, organizationId), eq(roles.isActive, true)),
      )
      .orderBy(asc(roles.name)),

    db
      .select({
        id: outlets.id,
        code: outlets.code,
        name: outlets.name,
      })
      .from(outlets)
      .where(
        and(
          eq(outlets.organizationId, organizationId),
          eq(outlets.isActive, true),
        ),
      )
      .orderBy(asc(outlets.name)),
  ]);

  return {
    roles: roleRows,
    outlets: outletRows,
  };
}

export async function getStaffDetail(organizationId: string, userId: string) {
  const userRows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      username: users.username,
      email: users.email,
      phone: users.phone,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.organizationId, organizationId)))
    .limit(1);

  const user = userRows[0];

  if (!user) {
    return null;
  }

  const [roleRows, outletRows] = await Promise.all([
    db
      .select({
        id: roles.id,
        code: roles.code,
        name: roles.name,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(
          eq(userRoles.userId, user.id),
          eq(roles.organizationId, organizationId),
        ),
      )
      .orderBy(asc(roles.name)),

    db
      .select({
        id: outlets.id,
        code: outlets.code,
        name: outlets.name,
        isPrimary: userOutlets.isPrimary,
      })
      .from(userOutlets)
      .innerJoin(outlets, eq(userOutlets.outletId, outlets.id))
      .where(
        and(
          eq(userOutlets.userId, user.id),
          eq(outlets.organizationId, organizationId),
        ),
      )
      .orderBy(asc(outlets.name)),
  ]);

  return {
    ...user,
    roles: roleRows,
    outlets: outletRows,
  };
}

export async function getPermissionCatalog() {
  return db
    .select({
      id: permissions.id,
      code: permissions.code,
      name: permissions.name,
      module: permissions.module,
      description: permissions.description,
    })
    .from(permissions)
    .orderBy(asc(permissions.module), asc(permissions.name));
}

export async function getRoleDetail(organizationId: string, roleId: string) {
  const roleRows = await db
    .select({
      id: roles.id,
      code: roles.code,
      name: roles.name,
      description: roles.description,
      isSystem: roles.isSystem,
      isActive: roles.isActive,
      createdAt: roles.createdAt,
      updatedAt: roles.updatedAt,
    })
    .from(roles)
    .where(and(eq(roles.id, roleId), eq(roles.organizationId, organizationId)))
    .limit(1);

  const role = roleRows[0];

  if (!role) {
    return null;
  }

  const [permissionRows, assignedUserStatusRows] = await Promise.all([
    db
      .select({
        id: permissions.id,
        code: permissions.code,
        name: permissions.name,
        module: permissions.module,
        description: permissions.description,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, role.id))
      .orderBy(asc(permissions.module), asc(permissions.name)),

    db
      .select({
        status: users.status,
        total: count(),
      })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(
        and(
          eq(userRoles.roleId, role.id),
          eq(users.organizationId, organizationId),
        ),
      )
      .groupBy(users.status),
  ]);

  const getUserCount = (status: "active" | "inactive" | "suspended") =>
    Number(
      assignedUserStatusRows.find((row) => row.status === status)?.total ?? 0,
    );

  return {
    ...role,

    permissions: permissionRows,

    userCount: assignedUserStatusRows.reduce(
      (total, row) => total + Number(row.total),
      0,
    ),

    activeUserCount: getUserCount("active"),

    inactiveUserCount: getUserCount("inactive"),

    suspendedUserCount: getUserCount("suspended"),
  };
}

export async function getRegisterOutletOptions(organizationId: string) {
  const [outletRows, hubRows] = await Promise.all([
    db
      .select({
        id: outlets.id,
        code: outlets.code,
        name: outlets.name,
      })
      .from(outlets)
      .where(
        and(
          eq(outlets.organizationId, organizationId),
          eq(outlets.isActive, true),
        ),
      )
      .orderBy(asc(outlets.name)),

    db
      .select({
        outletId: registers.outletId,
        id: registers.id,
        code: registers.code,
        name: registers.name,
      })
      .from(registers)
      .innerJoin(outlets, eq(registers.outletId, outlets.id))
      .where(
        and(
          eq(outlets.organizationId, organizationId),
          eq(registers.isHardwareHub, true),
        ),
      ),
  ]);

  const hubByOutlet = new Map<
    string,
    {
      id: string;
      code: string;
      name: string;
    }
  >();

  for (const hub of hubRows) {
    hubByOutlet.set(hub.outletId, {
      id: hub.id,
      code: hub.code,
      name: hub.name,
    });
  }

  return outletRows.map((outlet) => ({
    ...outlet,
    hardwareHub: hubByOutlet.get(outlet.id) ?? null,
  }));
}

export async function getOutletDetail(
  organizationId: string,
  outletId: string,
) {
  const outletRows = await db
    .select({
      id: outlets.id,
      code: outlets.code,
      name: outlets.name,
      address: outlets.address,
      phone: outlets.phone,
      googleMapsEmbedUrl: outlets.googleMapsEmbedUrl,
      isActive: outlets.isActive,
      createdAt: outlets.createdAt,
      updatedAt: outlets.updatedAt,
    })
    .from(outlets)
    .where(
      and(eq(outlets.id, outletId), eq(outlets.organizationId, organizationId)),
    )
    .limit(1);

  const outlet = outletRows[0];

  if (!outlet) {
    return null;
  }

  const [registerRows, assignedStaffRows, inventoryItemRows, activeShiftRows] =
    await Promise.all([
      db
        .select({
          id: registers.id,
          code: registers.code,
          name: registers.name,
          isHardwareHub: registers.isHardwareHub,
          isActive: registers.isActive,
        })
        .from(registers)
        .where(eq(registers.outletId, outlet.id))
        .orderBy(asc(registers.name)),

      db
        .select({
          total: count(),
        })
        .from(userOutlets)
        .where(eq(userOutlets.outletId, outlet.id)),

      db
        .select({
          total: count(),
        })
        .from(productItems)
        .where(
          and(
            eq(productItems.currentOutletId, outlet.id),
            eq(productItems.isActive, true),
            eq(productItems.locationState, "outlet"),
          ),
        ),

      db
        .select({
          total: count(),
        })
        .from(shifts)
        .where(
          and(
            eq(shifts.outletId, outlet.id),
            inArray(shifts.status, ["open", "closing"]),
          ),
        ),
    ]);

  return {
    ...outlet,

    registers: registerRows,

    registerCount: registerRows.length,

    activeRegisterCount: registerRows.filter((register) => register.isActive)
      .length,

    assignedStaffCount: Number(assignedStaffRows[0]?.total ?? 0),

    inventoryItemCount: Number(inventoryItemRows[0]?.total ?? 0),

    activeShiftCount: Number(activeShiftRows[0]?.total ?? 0),

    hardwareHub:
      registerRows.find((register) => register.isHardwareHub) ?? null,
  };
}

export async function getRegisterDetail(
  organizationId: string,
  registerId: string,
) {
  const registerRows = await db
    .select({
      id: registers.id,
      code: registers.code,
      name: registers.name,
      isHardwareHub: registers.isHardwareHub,
      isActive: registers.isActive,
      createdAt: registers.createdAt,
      updatedAt: registers.updatedAt,

      outletId: outlets.id,
      outletCode: outlets.code,
      outletName: outlets.name,
      outletIsActive: outlets.isActive,
    })
    .from(registers)
    .innerJoin(outlets, eq(registers.outletId, outlets.id))
    .where(
      and(
        eq(registers.id, registerId),
        eq(outlets.organizationId, organizationId),
      ),
    )
    .limit(1);

  const register = registerRows[0];

  if (!register) {
    return null;
  }

  const [shiftRows, activeShiftRows, saleRows] = await Promise.all([
    db
      .select({
        total: count(),
      })
      .from(shifts)
      .where(eq(shifts.registerId, register.id)),

    db
      .select({
        total: count(),
      })
      .from(shifts)
      .where(
        and(
          eq(shifts.registerId, register.id),
          inArray(shifts.status, ["open", "closing"]),
        ),
      ),

    db
      .select({
        total: count(),
      })
      .from(sales)
      .where(eq(sales.registerId, register.id)),
  ]);

  return {
    ...register,

    shiftCount: Number(shiftRows[0]?.total ?? 0),

    activeShiftCount: Number(activeShiftRows[0]?.total ?? 0),

    saleCount: Number(saleRows[0]?.total ?? 0),
  };
}
