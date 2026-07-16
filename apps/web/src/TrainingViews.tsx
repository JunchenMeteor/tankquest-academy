import type {
  LevelDto,
  OwnedTankDto,
  QuestionDto,
  StartSessionResponse,
  SubmitAnswerResponse,
  TankSkinDto,
} from '@tankquest/shared';

import { GameCanvas } from './game/GameCanvas.js';
import { TankPreview } from './game/presentation/TankPreview.js';
import type { RuntimeLevelConfig, RuntimeState } from './game/runtime/types.js';
import { useI18n } from './i18n/I18nProvider.js';
import { themes, type ThemeCode, useTheme } from './theme/ThemeProvider.js';

export function AppHud({
  active,
  runtime,
}: {
  active: boolean;
  runtime: RuntimeState;
}) {
  const { t } = useI18n();
  return (
    <header className="hud">
      <div>
        <p className="eyebrow">{t('app.base')}</p>
        <h1>TankQuest Academy</h1>
      </div>
      <dl>
        <div>
          <dt>{t('hud.tanks')}</dt>
          <dd>{runtime.enemiesRemaining}</dd>
        </div>
        <div>
          <dt>{t('hud.shots')}</dt>
          <dd>{runtime.shotsFired}</dd>
        </div>
        {active && (
          <div>
            <dt>{t('hud.health')}</dt>
            <dd>
              {runtime.playerHealth}/{runtime.playerMaxHealth}
            </dd>
          </div>
        )}
      </dl>
      <PreferenceControls />
    </header>
  );
}

export function PreferenceControls() {
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();
  return (
    <div className="preference-controls">
      <label>
        {t('settings.language')}
        <select
          aria-label={t('settings.language')}
          value={locale}
          onChange={(event) =>
            setLocale(event.target.value === 'zh-CN' ? 'zh-CN' : 'en')
          }
        >
          <option value="en">{t('language.en')}</option>
          <option value="zh-CN">{t('language.zh-CN')}</option>
        </select>
      </label>
      <label>
        {t('settings.theme')}
        <select
          aria-label={t('settings.theme')}
          value={theme}
          onChange={(event) => setTheme(event.target.value as ThemeCode)}
        >
          {themes.map((code) => (
            <option key={code} value={code}>
              {t(`theme.${code}`)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function MissionPicker({
  busy,
  levels,
  preview,
  selectedLevelId,
  selectedTankId,
  skins,
  tanks,
  onSelectLevel,
  onSelectTank,
  onEquipSkin,
  onStart,
}: {
  busy: boolean;
  levels: LevelDto[];
  preview: RuntimeLevelConfig | undefined;
  selectedLevelId: string;
  selectedTankId: string;
  tanks: OwnedTankDto[];
  skins: TankSkinDto[];
  onSelectLevel: (levelId: string) => void;
  onSelectTank: (tankId: string) => void;
  onEquipSkin: (skinId: string) => void;
  onStart: () => void;
}) {
  const { t } = useI18n();
  return (
    <section className="status-card">
      <h2>{t('picker.title')}</h2>
      <p>{t('picker.ready', { count: levels.length })}</p>
      <div className="mission-picker" aria-label={t('picker.missions')}>
        {levels.map((level) => (
          <button
            key={level.id}
            className={level.id === selectedLevelId ? 'selected' : ''}
            aria-pressed={level.id === selectedLevelId}
            onClick={() => onSelectLevel(level.id)}
          >
            {contentName(level.code, t)} ·{' '}
            {t('picker.difficulty', { value: level.baseDifficulty })}
          </button>
        ))}
      </div>
      <h3>{t('picker.tank')}</h3>
      <div className="tank-picker" aria-label={t('picker.ownedTanks')}>
        {tanks.map((tank) => (
          <button
            key={tank.id}
            className={tank.id === selectedTankId ? 'selected' : ''}
            aria-pressed={tank.id === selectedTankId}
            onClick={() => onSelectTank(tank.id)}
          >
            <TankPreview
              code={tank.code}
              primaryColor={tank.skin?.primaryColor}
              secondaryColor={tank.skin?.secondaryColor}
              visualResources={preview?.visualResources}
            />
            <strong>{contentName(tank.code, t)}</strong>
            <span>
              {t(`role.${tank.role}`)} ·{' '}
              {t('picker.level', { value: tank.level })}
            </span>
            <span>
              {t('stat.firepower')} {tank.stats.firepower} ·{' '}
              {t('stat.mobility')} {tank.stats.mobility} · {t('stat.armor')}{' '}
              {tank.stats.armor} · {t('stat.stealth')} {tank.stats.stealth} ·{' '}
              {t('stat.vision')} {tank.stats.vision}
            </span>
          </button>
        ))}
      </div>
      <div className="skin-picker" aria-label={t('picker.skins')}>
        {skins.map((skin) => (
          <button
            key={skin.id}
            className={skin.equipped ? 'selected' : ''}
            aria-pressed={skin.equipped}
            disabled={busy || !skin.unlocked}
            onClick={() => onEquipSkin(skin.id)}
          >
            <span
              className="skin-swatch"
              style={{
                background: `linear-gradient(135deg, ${skin.primaryColor} 50%, ${skin.secondaryColor} 50%)`,
              }}
            />
            {contentName(skin.code, t)}
          </button>
        ))}
      </div>
      {preview && (
        <p className="mission-preview">
          {t('picker.preview', {
            map: contentName(preview.mapStyle, t),
            enemies: summarizeEnemies(preview, t),
          })}
        </p>
      )}
      <button disabled={busy} onClick={onStart}>
        {t('action.start')}
      </button>
    </section>
  );
}

export function ActiveTraining({
  busy,
  config,
  currentQuestion,
  feedback,
  learningComplete,
  questionIndex,
  runtime,
  session,
  onAnswer,
  onContinue,
  onRestart,
  onReturn,
  onRuntime,
}: {
  busy: boolean;
  config: RuntimeLevelConfig;
  currentQuestion: QuestionDto;
  feedback: SubmitAnswerResponse | null;
  learningComplete: boolean;
  questionIndex: number;
  runtime: RuntimeState;
  session: StartSessionResponse;
  onAnswer: (answerId: string) => void;
  onContinue: () => void;
  onRestart: () => void;
  onReturn: () => void;
  onRuntime: (state: RuntimeState) => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <p className="mission-status">
        {contentName(session.level.code, t)} · {t('stat.firepower')}{' '}
        {session.tank.stats.firepower} · {t('stat.mobility')}{' '}
        {session.tank.stats.mobility} · {t('stat.armor')}{' '}
        {session.tank.stats.armor} · {t('stat.stealth')}{' '}
        {session.tank.stats.stealth} · {t('stat.vision')}{' '}
        {session.tank.stats.vision}
      </p>
      <p className="combat-readout">
        {t('stat.shell')} {config.player.projectileDamage} ·{' '}
        {t('stat.penetration')} {config.player.projectilePenetration} ·{' '}
        {t('stat.armor')} {config.player.armorProfile.front}/
        {config.player.armorProfile.side}/{config.player.armorProfile.rear} ·{' '}
        {t('stat.speed')} {config.player.speed} · {t('stat.mass')}{' '}
        {config.player.mass} · {t('stat.detection')}{' '}
        {config.player.detectionRange}
      </p>
      <GameCanvas config={config} onState={onRuntime} />
      {runtime.playerDestroyed ? (
        <section className="battle-alert" aria-live="assertive">
          <p className="eyebrow">{t('battle.paused')}</p>
          <h2>{t('battle.disabled')}</h2>
          <p>{t('battle.disabledHint')}</p>
          <div className="result-actions">
            <button disabled={busy} onClick={onRestart}>
              {t('action.restart')}
            </button>
            <button disabled={busy} onClick={onReturn}>
              {t('action.return')}
            </button>
          </div>
        </section>
      ) : learningComplete ? (
        <section className="battle-objective" aria-live="polite">
          <p className="eyebrow">{t('battle.supplies')}</p>
          <h2>
            {runtime.enemiesRemaining > 0
              ? t('battle.remaining', { count: runtime.enemiesRemaining })
              : t('battle.secured')}
          </h2>
          <p>{t('battle.objective')}</p>
          {runtime.enemiesRemaining === 0 && (
            <button disabled={busy} onClick={onContinue}>
              {t('action.complete')}
            </button>
          )}
        </section>
      ) : (
        <LearningConsole
          busy={busy}
          currentQuestion={currentQuestion}
          feedback={feedback}
          questionCount={session.questions.length}
          questionIndex={questionIndex}
          enemiesRemaining={runtime.enemiesRemaining}
          onAnswer={onAnswer}
          onContinue={onContinue}
        />
      )}
      <p className="controls">{t('battle.controls')}</p>
    </>
  );
}

function LearningConsole({
  busy,
  currentQuestion,
  enemiesRemaining,
  feedback,
  questionCount,
  questionIndex,
  onAnswer,
  onContinue,
}: {
  busy: boolean;
  currentQuestion: QuestionDto;
  enemiesRemaining: number;
  feedback: SubmitAnswerResponse | null;
  questionCount: number;
  questionIndex: number;
  onAnswer: (answerId: string) => void;
  onContinue: () => void;
}) {
  const { t } = useI18n();
  return (
    <section className="learning-console" aria-live="polite">
      <p className="eyebrow">
        {t('learning.challenge', {
          current: questionIndex + 1,
          total: questionCount,
        })}
      </p>
      <h2>{currentQuestion.prompt}</h2>
      <div className="choices">
        {currentQuestion.choices.map((choice) => (
          <button
            key={choice.id}
            disabled={busy || Boolean(feedback)}
            onClick={() => onAnswer(choice.id)}
          >
            {choice.text}
          </button>
        ))}
      </div>
      {feedback && (
        <div className={feedback.correct ? 'feedback good' : 'feedback'}>
          <strong>
            {feedback.correct ? t('learning.correct') : t('learning.retry')}
          </strong>
          <span>{feedback.explanation}</span>
          <button disabled={busy} onClick={onContinue}>
            {questionIndex < questionCount - 1
              ? t('action.next')
              : enemiesRemaining > 0
                ? t('action.battle')
                : t('action.complete')}
          </button>
        </div>
      )}
    </section>
  );
}

function formatTankName(code: string) {
  return code
    .split('-')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function contentName(code: string, t: (key: string) => string) {
  const key = `content.${code}`;
  const translated = t(key);
  return translated === key ? formatTankName(code) : translated;
}

function summarizeEnemies(
  config: RuntimeLevelConfig,
  t: (key: string) => string
) {
  const counts = new Map<string, number>();
  for (const enemy of config.enemies) {
    counts.set(enemy.role, (counts.get(enemy.role) ?? 0) + 1);
  }
  return [...counts]
    .map(([role, count]) => {
      const name = t(`role.${role}`);
      return `${count} ${count > 1 && name === role ? `${name}s` : name}`;
    })
    .join(' + ');
}
