-- 舆图山河录 · RDS Schema
-- 华为云 RDS for MySQL 8.0
-- 数据库：history_geo_classroom

CREATE DATABASE IF NOT EXISTS history_geo_classroom
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE history_geo_classroom;

-- ========== 知识库表 ==========

-- 知识条目主表
CREATE TABLE knowledge_entries (
  id VARCHAR(32) PRIMARY KEY,
  dynasty ENUM('tang', 'ming') NOT NULL,
  question TEXT NOT NULL,
  keywords JSON NOT NULL,
  answer TEXT NOT NULL,
  caliber VARCHAR(32) NOT NULL,
  no_consensus BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dynasty (dynasty),
  INDEX idx_caliber (caliber)
);

-- 出处证据表（一条知识可有多条出处）
CREATE TABLE evidence (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  entry_id VARCHAR(32) NOT NULL,
  source VARCHAR(128) NOT NULL,
  quote TEXT NOT NULL,
  confidence ENUM('high', 'medium', 'low') NOT NULL DEFAULT 'medium',
  sort_order INT DEFAULT 0,
  FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  INDEX idx_entry (entry_id)
);

-- 地图动作表（一条知识可选关联一个地图动作）
CREATE TABLE map_actions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  entry_id VARCHAR(32) NOT NULL UNIQUE,
  dynasty VARCHAR(16) NOT NULL,
  year INT,
  layer ENUM('admin', 'military', 'journey', 'cultural') NOT NULL,
  focus_lng DECIMAL(10, 4),
  focus_lat DECIMAL(10, 4),
  FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id) ON DELETE CASCADE
);

-- ========== 偏差归因映射表 ==========

-- 问题→偏差类型映射（用于根据 questionId 自动归因）
CREATE TABLE deviation_type_map (
  question_id VARCHAR(32) PRIMARY KEY,
  deviation_type ENUM('管到/写到混淆', '走到/管到混淆', '写到/管到混淆', '范围超出', '正确') NOT NULL
);

-- 偏差类型→教学建议映射
CREATE TABLE deviation_suggestions (
  deviation_type ENUM('管到/写到混淆', '走到/管到混淆', '写到/管到混淆', '范围超出', '正确') PRIMARY KEY,
  suggestion TEXT NOT NULL
);

-- ========== 课堂与作答表 ==========

-- 班级表
CREATE TABLE classes (
  class_id VARCHAR(32) PRIMARY KEY,
  class_name VARCHAR(64),
  teacher_id VARCHAR(32),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 学生表
CREATE TABLE students (
  student_id VARCHAR(32) PRIMARY KEY,
  class_id VARCHAR(32),
  display_name VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE SET NULL,
  INDEX idx_class (class_id)
);

-- 作答记录表
CREATE TABLE answer_records (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(32) NOT NULL,
  class_id VARCHAR(32) NOT NULL,
  question_id VARCHAR(32) NOT NULL,
  answer TEXT NOT NULL,
  is_correct BOOLEAN,
  deviation_type ENUM('管到/写到混淆', '走到/管到混淆', '写到/管到混淆', '范围超出', '正确'),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
  INDEX idx_class_question (class_id, question_id),
  INDEX idx_student (student_id),
  INDEX idx_deviation (deviation_type)
);

-- ========== 讲解包缓存表（可选，用于缓存生成的讲解包） ==========

CREATE TABLE lecture_packages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  dynasty ENUM('tang', 'ming') NOT NULL,
  package_data JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_dynasty (dynasty)
);

-- ========== 初始化数据 ==========

-- 偏差类型建议
INSERT INTO deviation_suggestions VALUES
  ('管到/写到混淆', '建议用唐代安西都护府一页做对比讲解：直辖与羁縻是两种不同的管辖方式'),
  ('走到/管到混淆', '建议区分行迹到达与行政管辖：玄奘走到的地方不等于唐朝管到的地方'),
  ('写到/管到混淆', '建议区分文献记载与实际设治：《禹贡》九州是写到，不是管到'),
  ('范围超出', '建议说明明朝北面为蒙古诸部，无稳定边界，本系统不画闭合北界'),
  ('正确', '该知识点掌握良好');

-- 偏差类型映射（与 deviation.ts 中 deviationTypeMap 一致）
INSERT INTO deviation_type_map VALUES
  ('tang-q1', '管到/写到混淆'),
  ('tang-q2', '管到/写到混淆'),
  ('tang-q3', '管到/写到混淆'),
  ('tang-q4', '管到/写到混淆'),
  ('tang-q5', '走到/管到混淆'),
  ('tang-q10', '走到/管到混淆'),
  ('ming-q1', '管到/写到混淆'),
  ('ming-q2', '管到/写到混淆'),
  ('ming-q3', '范围超出'),
  ('ming-q5', '走到/管到混淆');