import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { Icon } from '../components/Icon';
import { Card, ConfirmButton, StatTile } from '../components/ui';
import { validateDataset } from '../core/dataset';
import { createDemoDataset } from '../data/demo';
import { useFileSaver } from '../state/fileSaver';
import { useStudentOS } from '../state/store';
import { AccountCard } from './AccountCard';

type Status = { kind: 'idle' } | { kind: 'ok'; message: string } | { kind: 'error'; errors: string[] };

const SCHEMA_EXAMPLE = `{
  "version": 1,
  "school": "示例中学",
  "className": "高二(3)班",
  "subjects": [{ "id": "math", "name": "数学", "fullMark": 150 }],
  "exams":    [{ "id": "g2-oct", "name": "高二十月月考", "date": "2026-10-17", "term": "2026–2027 第一学期" }],
  "students": [{
    "id": "2025030101",
    "name": "林知夏",
    "indicators": {
      "health.fitness": 68,                                   // 写实记录：0–100
      "moral.integrity": { "self": 92, "peer": 90, "teacher": 93 } // 多主体评价
    }
  }],
  "scores": [{ "studentId": "2025030101", "examId": "g2-oct", "subjectId": "math", "score": 97 }]
}`;

export function DataView() {
  const { dataset, isDemo, importDataset, resetDemo, todos, sync } = useStudentOS();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [over, setOver] = useState(false);
  const [saveNote, setSaveNote] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const saver = useFileSaver();

  const exportJSON = async (filename: string, data: unknown) => {
    const outcome = await saver.save(filename, JSON.stringify(data, null, 2));
    setSaveNote(outcome === 'saved' ? `已导出 ${filename}` : outcome === 'declined' ? '已取消保存' : '当前环境无法保存文件');
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const result = validateDataset(JSON.parse(await file.text()));
      if (!result.ok) {
        setStatus({ kind: 'error', errors: result.errors });
        return;
      }
      importDataset(result.dataset);
      setStatus({
        kind: 'ok',
        message: `已导入「${result.dataset.className}」：${result.dataset.students.length} 名学生、${result.dataset.scores.length} 条成绩记录`,
      });
    } catch {
      setStatus({ kind: 'error', errors: ['无法解析文件，请确认是有效的 JSON'] });
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="grid">
      <AccountCard />
      <StatTile label="班级" value={dataset.className} foot={`${dataset.school} · ${isDemo ? '演示数据' : '已导入数据'}`} />
      <StatTile label="学生" value={dataset.students.length} unit="人" />
      <StatTile label="考试 / 学科" value={`${dataset.exams.length} / ${dataset.subjects.length}`} />
      <StatTile label="成绩记录" value={dataset.scores.length} unit="条" />

      <Card className="span-7" title="导入数据" sub={`JSON 格式，包含学科、考试、学生素质数据与成绩；导入后保存到当前账号${sync.remote ? '（云端）' : '（本机）'}`}>
        <div
          className={`dropzone${over ? ' over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          <Icon name="upload" size={26} />
          <p style={{ fontWeight: 560 }}>拖拽 JSON 文件到这里</p>
          <p className="muted" style={{ fontSize: 12.5 }}>
            或
          </p>
          <button type="button" className="btn primary" onClick={() => inputRef.current?.click()}>
            选择文件
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
        </div>
        {status.kind === 'ok' && (
          <div className="notice" style={{ marginTop: 14, ['--tone' as string]: 'var(--good)' }} role="status">
            {status.message}
          </div>
        )}
        {status.kind === 'error' && (
          <div className="notice" style={{ marginTop: 14, ['--tone' as string]: 'var(--critical)' }} role="alert">
            导入失败，请修正以下问题：
            <ul>
              {status.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card className="span-5" title="导出与重置">
        <div className="stack" style={{ gap: 10 }}>
          {saver.available && (
            <>
              <button type="button" className="btn" onClick={() => void exportJSON(`studentos-${dataset.className}.json`, dataset)}>
                <Icon name="download" size={16} />
                导出当前数据
              </button>
              <button type="button" className="btn" onClick={() => void exportJSON('studentos-template.json', createDemoDataset())}>
                <Icon name="download" size={16} />
                下载数据模板（演示数据）
              </button>
            </>
          )}
          <ConfirmButton
            label="恢复演示数据"
            prompt="将替换当前导入的数据"
            confirmLabel="恢复"
            icon={<Icon name="reset" size={16} />}
            disabled={isDemo}
            onConfirm={() => {
              resetDemo();
              setStatus({ kind: 'ok', message: '已恢复演示数据' });
            }}
          />
          <ConfirmButton
            label="清空待办记录"
            prompt="清空所有学生的完成记录与自定义待办"
            confirmLabel="清空"
            icon={<Icon name="trash" size={16} />}
            danger
            onConfirm={() => {
              todos.clear();
              setSaveNote('已清空待办记录');
            }}
          />
          {saveNote && (
            <p className="card-sub" role="status">
              {saveNote}
            </p>
          )}
        </div>
      </Card>

      <Card className="span-12" title="数据格式" sub="指标 id 见「评价体系」页的指标体系；学业成绩与学科均衡由成绩自动计算，无需填写">
        <div className="formula">{SCHEMA_EXAMPLE}</div>
      </Card>
    </div>
  );
}
