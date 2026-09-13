"""Exercise official SDK2 DDS LowCmd/LowState through a real MuJoCo control loop.

Domain 42 and loopback only. This executable cannot address a physical robot.
"""
import os
import sys
import time
import json
import platform
import numpy as np
import mujoco
from g1_policy import G1Controller, ROOT

os.environ.setdefault('CYCLONEDDS_HOME', str(ROOT/'vendor/cyclonedds/install'))
from unitree_sdk2py.core.channel import ChannelFactoryInitialize, ChannelPublisher, ChannelSubscriber
from unitree_sdk2py.idl.unitree_hg.msg.dds_ import LowCmd_, LowState_
from unitree_sdk2py.idl.default import unitree_hg_msg_dds__LowCmd_, unitree_hg_msg_dds__LowState_
from unitree_sdk2py.utils.crc import CRC


def main():
    interface = 'lo0' if platform.system() == 'Darwin' else 'lo'
    ChannelFactoryInitialize(42, interface)
    command_out = ChannelPublisher('rt/lowcmd', LowCmd_)
    command_in = ChannelSubscriber('rt/lowcmd', LowCmd_)
    state_out = ChannelPublisher('rt/lowstate', LowState_)
    state_in = ChannelSubscriber('rt/lowstate', LowState_)
    channels = [command_out, command_in, state_out, state_in]
    for channel in channels:
        channel.Init()
    time.sleep(.25)
    sim = G1Controller()
    crc = CRC()
    received = 0
    latencies = []
    for tick in range(500):
        command = unitree_hg_msg_dds__LowCmd_()
        command.mode_pr = 0
        command.mode_machine = 5
        for i in range(12):
            motor = command.motor_cmd[i]
            motor.mode = 1
            motor.q = float(sim.target[i])
            motor.kp = float(sim.kp[i])
            motor.kd = float(sim.kd[i])
        command.crc = crc.Crc(command)
        started = time.perf_counter()
        command_out.Write(command)
        packet = command_in.Read(2)
        if packet is None or crc.Crc(packet) != packet.crc:
            raise RuntimeError('Missing or corrupt SDK command; stopping simulation')
        latencies.append((time.perf_counter()-started)*1000)
        received += 1
        # Physics torques come from the received official SDK command packet.
        for _ in range(10):
            for i in range(12):
                motor = packet.motor_cmd[i]
                sim.data.ctrl[i] = motor.tau+motor.kp*(motor.q-sim.data.qpos[7+i])+motor.kd*(motor.dq-sim.data.qvel[6+i])
            mujoco.mj_step(sim.model,sim.data)
            sim.counter += 1
        state = unitree_hg_msg_dds__LowState_()
        state.tick = tick
        for i in range(12):
            state.motor_state[i].q = float(sim.data.qpos[7+i])
            state.motor_state[i].dq = float(sim.data.qvel[6+i])
        state.imu_state.quaternion = sim.data.qpos[3:7].tolist()
        state.imu_state.gyroscope = sim.data.qvel[3:6].tolist()
        state_out.Write(state)
        feedback = state_in.Read(2)
        if feedback is None:
            raise RuntimeError('SDK feedback unavailable')
        assert abs(feedback.motor_state[0].q-sim.data.qpos[7]) < 1e-5
        sim.update_target([.5 if tick>=50 else 0,0,0])
    result = {'sdk':'unitree_sdk2_python','revision':'65691c8a8bc53b98d3976dba4dbf9d5d20b2e7f5',
              'domain':42,'interface':interface,'command_messages':received,'feedback_messages':received,
              'crc_verified':True,'simulated_seconds':float(sim.data.time),
              'distance_m':float(sim.data.qpos[0]),'height_m':float(sim.data.qpos[2]),
              'roundtrip_p50_ms':float(np.median(latencies)),
              'physical_robot_connected':False,'control':'Received LowCmd PD gains and targets applied to MuJoCo joints'}
    assert result['distance_m'] > 2 and result['height_m'] > .5
    (ROOT/'artifacts/fork/unitree-sdk-verification.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result),flush=True)
    for channel in channels:
        channel.Close()


if __name__ == '__main__':
    try:
        main()
    except Exception:
        import traceback
        traceback.print_exc()
        sys.stderr.flush()
        os._exit(1)
    # SDK 0.10.2 DDS background threads can otherwise keep macOS Python alive.
    sys.stdout.flush()
    os._exit(0)
