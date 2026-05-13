import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const renderMock = vi.fn();
const createRootMock = vi.fn(() => ({ render: renderMock, unmount: vi.fn() }));

vi.mock('react-dom/client', () => ({
  createRoot: createRootMock,
}));

describe('main.tsx', () => {
  beforeEach(() => {
    renderMock.mockClear();
    createRootMock.mockClear();
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.resetModules();
  });

  it('mounts <App /> into the #root element', async () => {
    await import('./main.tsx');

    expect(createRootMock).toHaveBeenCalledTimes(1);
    const [rootArg] = createRootMock.mock.calls[0] as unknown as [HTMLElement];
    expect(rootArg.id).toBe('root');

    expect(renderMock).toHaveBeenCalledTimes(1);
    const [treeArg] = renderMock.mock.calls[0] as unknown as [unknown];
    expect(treeArg).toBeDefined();
    expect(typeof treeArg).toBe('object');
  });
});
