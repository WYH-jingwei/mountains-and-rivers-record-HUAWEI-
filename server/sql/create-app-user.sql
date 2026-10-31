-- ============================================================
-- 在 Navicat 的「Insight」连接（localhost:3306）中新建查询并执行本脚本
-- 作用：创建本项目专用数据库与专用账号 history，不影响现有 root
-- 如需修改密码，把下面两处 'History@2026' 替换为你的密码即可
-- ============================================================

-- 1. 建库（utf8mb4 支持中文与生僻字）
CREATE DATABASE IF NOT EXISTS history_geo_classroom
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 2. 建专用账号（'%' 表示本机/任意来源均可连接，覆盖 127.0.0.1 与 localhost）
CREATE USER IF NOT EXISTS 'history'@'%' IDENTIFIED BY 'History@2026';
ALTER USER 'history'@'%' IDENTIFIED BY 'History@2026';

-- 3. 仅授予本项目数据库的权限（最小权限原则）
GRANT ALL PRIVILEGES ON history_geo_classroom.* TO 'history'@'%';

FLUSH PRIVILEGES;

-- 验证：执行后应能看到 history_geo_classroom 库
SHOW DATABASES LIKE 'history_geo_classroom';
