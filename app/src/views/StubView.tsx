import { Topbar } from '../components/Topbar';

interface Props {
  label: string;
  title: string;
}

export function StubView({ label, title }: Props) {
  return (
    <div>
      <Topbar crumbs={['Soundings', title]} />
      <div className="stub">
        <div className="label">— {label}</div>
        <div>Not yet engraved.</div>
      </div>
    </div>
  );
}
