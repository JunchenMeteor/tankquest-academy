# 数据库设计草案

## 1. 设计原则

- PostgreSQL 作为主数据库。
- 资源文件不进数据库，只保存 URL、hash、版本和元数据。
- 题库、关卡、坦克、涂装和奖励规则全部数据化。
- 对局事件保留，用于复盘、学习分析和防作弊。
- 儿童模式、青少年模式、成人模式的数据范围必须可区分。

## 2. 用户与档案

```text
users(id, email, password_hash, display_name, role, created_at, updated_at)
children(id, parent_user_id, nickname, birth_year, age_group, avatar_asset_id, default_mode, created_at, updated_at)
parent_controls(id, child_id, daily_minutes_limit, session_minutes_limit, allowed_modes, allowed_subjects, max_difficulty, ai_explanation_enabled, adult_tests_enabled, online_sync_enabled, updated_at)
```

## 3. 坦克与涂装

```text
tanks(id, code, name_key, description_key, role, model_asset_id, default_skin_id, unlock_rule, is_active)
tank_stats(id, tank_id, firepower, mobility, armor, stealth, vision)
tank_skins(id, tank_id, code, name_key, texture_asset_id, theme, bonus_type, bonus_value, unlock_rule)
child_tanks(id, child_id, tank_id, level, acquired_at, selected_skin_id)
child_tank_upgrades(id, child_tank_id, stat_key, level, updated_at)
```

## 4. 关卡与地图

```text
levels(id, code, title_key, description_key, mode, subject_focus, base_difficulty, theme_id, map_asset_id, config_json, status, version)
level_objectives(id, level_id, objective_type, target_key, required_count, reward_rule_id)
level_enemy_configs(id, level_id, enemy_type, count, spawn_rule_json, behavior_json, difficulty_scale)
```

## 5. 题库

```text
questions(id, subject, mode, difficulty, prompt_key, prompt_params_json, explanation_key, explanation_params_json, source, status, created_by, reviewed_by)
question_answers(id, question_id, answer_text, answer_key, is_correct, sort_order)
question_tags(id, question_id, tag)
```

## 6. 对局与事件

```text
game_sessions(id, child_id, level_id, tank_id, mode, status, started_at, finished_at, client_version, difficulty_snapshot_json, reward_summary_json)
game_session_events(id, session_id, event_type, event_payload_json, client_time_ms, server_received_at)
game_session_answers(id, session_id, question_id, selected_answer_id, is_correct, answer_time_ms, explanation_requested, created_at)
```

## 7. 奖励与学习记录

```text
reward_rules(id, code, rule_json, status, version)
game_session_rewards(id, session_id, reward_type, reward_key, amount, reason)
child_inventory(id, child_id, item_type, item_key, amount)
badges(id, code, name_key, description_key, icon_asset_id, unlock_rule_json)
child_badges(id, child_id, badge_id, acquired_at)
learning_records(id, child_id, subject, skill_key, attempts, correct_count, average_answer_time_ms, current_difficulty, updated_at)
```

## 8. 资源与主题

```text
assets(id, type, url, version, hash, size_bytes, tags, locale, theme, dependencies_json, created_at)
themes(id, code, name_key, palette_json, tile_set_asset_id, music_asset_id, status)
```

## 9. AI 记录

```text
ai_requests(id, user_id, child_id, request_type, input_summary_json, output_json, safety_status, model_name, created_at)
ai_generated_questions(id, question_id, ai_request_id, review_status, reviewer_user_id, created_at)
```

AI 生成内容必须先审核或通过后端校验，不能直接进入正式题库。
