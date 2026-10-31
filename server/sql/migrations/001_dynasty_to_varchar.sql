-- 迁移 001：朝代字段由 ENUM 放宽为 VARCHAR，支持全朝代材料池扩充
-- 适用：已按旧 schema 初始化过的 history_geo_classroom 库
-- 执行：mysql -u root -p < 001_dynasty_to_varchar.sql
USE history_geo_classroom;

-- 知识条目主表：ENUM('tang','ming') -> VARCHAR(32)，保留现有数据与 idx_dynasty 索引
ALTER TABLE knowledge_entries
  MODIFY COLUMN dynasty VARCHAR(32) NOT NULL;

-- 讲解包缓存表：ENUM('tang','ming') -> VARCHAR(16)
ALTER TABLE lecture_packages
  MODIFY COLUMN dynasty VARCHAR(16) NOT NULL;
