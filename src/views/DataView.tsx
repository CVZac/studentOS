import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { Icon } from '../components/Icon';
import { Card, StatTile } from '../components/ui';
import { validateDataset } from '../core/dataset';
import { createDemoDataset } from '../data/demo';
import { useStudentOS } from '../state/store';

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

function download(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DataView() {
  const { dataset, isDemo, importDataset, resetDemo, todos } = useStudentOS();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
      <StatTile label="班级" value={dataset.className} foot={`${dataset.school} · ${isDemo ? '演示数据' : '已导入数据'}`} />
      <StatTile label="学生" value={dataset.students.length} unit="人" />
      <StatTile label="考试 / 学科" value={`${dataset.exams.length} / ${dataset.subjects.length}`} />
      <StatTile label="成绩记录" value={dataset.scores.length} unit="条" />

      <Card className="span-7" title="导入数据" sub="JSON 格式，包含学科、考试、学生素质数据与成绩；导入后保存在本机浏览器中">
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
          <button type="button" className="btn" onClick={() => download(`studentos-${dataset.className}.json`, dataset)}>
            <Icon name="download" size={16} />
            导出当前数据
          </button>
          <button type="button" className="btn" onClick={() => download('studentos-template.json', createDemoDataset())}>
            <Icon name="download" size={16} />
            下载数据模板（演示数据）
          </button>
          <button
            type="button"
            className="btn"
            disabled={isDemo}
            onClick={() => {
              if (window.confirm('恢复演示数据会替换当前导入的数据，确定继续吗？')) {
                resetDemo();
                setStatus({ kind: 'ok', message: '已恢复演示数据' });
              }
            }}
          >
            <Icon name="reset" size={16} />
            恢复演示数据
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              if (window.confirm('确定清空所有学生的待办完成记录与自定义待办吗？')) todos.clear();
            }}
          >
            <Icon name="trash" size={16} />
            清空待办记录
          </button>
        </div>
      </Card>

      <Card className="span-12" title="数据格式" sub="指标 id 见「评价体系」页的指标体系；学业成绩与学科均衡由成绩自动计算，无需填写">
        <div className="formula">{SCHEMA_EXAMPLE}</div>
      </Card>
    </div>
  );
}
