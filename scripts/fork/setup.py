"""Reproducible local setup; preserves existing credentials and project files."""
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]


def run(args, **kwargs):
    print('+ '+' '.join(map(str,args)),flush=True)
    subprocess.run(list(map(str,args)),cwd=ROOT,check=True,**kwargs)


def checkout(name,url,revision,sparse=None):
    target=ROOT/'vendor'/name
    if not (target/'.git').exists():
        run(['git','clone','--filter=blob:none','--no-checkout',url,target])
        if sparse:
            run(['git','-C',target,'sparse-checkout','set',*sparse])
        run(['git','-C',target,'checkout',revision])
    else:
        head=subprocess.check_output(['git','-C',str(target),'rev-parse','HEAD'],text=True).strip()
        if head!=revision:
            raise RuntimeError(f'{name} revision differs. Preserve your checkout and use a fresh package directory.')
    return target


def main():
    if sys.version_info<(3,11):
        raise SystemExit('Use Python 3.11 or newer (verified with Python 3.12).')
    for tool in ['git','node','npm','cmake']:
        if not shutil.which(tool):
            raise SystemExit(f'Install {tool} first; see docs/fork/README.md.')
    envdir=ROOT/'.venv-fork'
    if not envdir.exists():
        run([sys.executable,'-m','venv',envdir])
    python=envdir/'bin/python'
    run([python,'-m','pip','install','-r','scripts/fork/requirements.txt'])
    checkout('unitree_rl_gym','https://github.com/unitreerobotics/unitree_rl_gym.git',
             '276801e46c5d433564f24658bac64f254b7d2d4b',
             ['deploy/pre_train/g1','deploy/deploy_mujoco','resources/robots/g1_description'])
    sdk=checkout('unitree_sdk2_python','https://github.com/unitreerobotics/unitree_sdk2_python.git',
                 '65691c8a8bc53b98d3976dba4dbf9d5d20b2e7f5')
    dds=checkout('cyclonedds','https://github.com/eclipse-cyclonedds/cyclonedds.git',
                 '9995905bce6c4cf9f740d6438bbf7fcfd1c83dfd')
    install=dds/'install'
    if not (install/'lib').exists():
        run(['cmake','-S',dds,'-B',dds/'build',f'-DCMAKE_INSTALL_PREFIX={install}',
             '-DBUILD_EXAMPLES=OFF','-DBUILD_TESTING=OFF','-DENABLE_SECURITY=OFF'])
        run(['cmake','--build',dds/'build','-j','4'])
        run(['cmake','--install',dds/'build'])
    run([python,'-m','pip','install','-e',sdk],env={**os.environ,'CYCLONEDDS_HOME':str(install)})
    if not (ROOT/'.env').exists():
        shutil.copyfile(ROOT/'.env.example',ROOT/'.env')
        (ROOT/'.env').chmod(0o600)
    run(['npm','ci'])
    run(['npm','run','build'])
    print('Ready. Start with: .venv-fork/bin/python scripts/fork/start.py')


if __name__=='__main__':
    main()
