import time
import lgpio

from jubilee_controller import JubileeMotionController
from pipette import Pipette


# ============================================================
# CONFIGURAÇÃO
# ============================================================

jubilee = JubileeMotionController()
pipeta = Pipette(jubilee)

# Potes/recipientes fixos
POTE_ORIGEM = (88, 310)
POTE_DESTINO = (88, 165)

# Alturas
Z_ASPIRAR = 165
Z_DESTINO = 165

# Volume a pipetar
VOLUME = 1000

# Tempos
TEMPO_AGITACAO = 30
TEMPO_AQUECIMENTO = 300

# GPIOs
AGITADOR_GPIO = 6
AQUECEDOR_GPIO = 5


# ============================================================
# GPIO
# ============================================================

gpio = lgpio.gpiochip_open(0)

lgpio.gpio_claim_output(gpio, AGITADOR_GPIO)
lgpio.gpio_claim_output(gpio, AQUECEDOR_GPIO)


# ============================================================
# AGITADOR
# ============================================================

def ligar_agitador():
    lgpio.gpio_write(gpio, AGITADOR_GPIO, 1)


def desligar_agitador():
    lgpio.gpio_write(gpio, AGITADOR_GPIO, 0)


def agitar(tempo=TEMPO_AGITACAO):
    ligar_agitador()
    time.sleep(tempo)
    desligar_agitador()


# ============================================================
# AQUECEDOR
# ============================================================

def ligar_aquecedor():
    lgpio.gpio_write(gpio, AQUECEDOR_GPIO, 1)


def desligar_aquecedor():
    lgpio.gpio_write(gpio, AQUECEDOR_GPIO, 0)


def aquecer(tempo=TEMPO_AQUECIMENTO):
    ligar_aquecedor()
    time.sleep(tempo)
    desligar_aquecedor()


# ============================================================
# MOVIMENTOS DA PIPETA
# ============================================================

def pegar_liquido():
    x, y = POTE_ORIGEM

    jubilee.move_xyz_absolute(
        x=x, y=y, velocity=15000
    )

    jubilee.move_xyz_absolute(
        z=Z_ASPIRAR, velocity=4000
    )

    pipeta.press(VOLUME)
    pipeta.aspirate()


def descartar_liquido():
    x, y = POTE_DESTINO

    jubilee.move_xyz_absolute(
        z=Z_DESTINO, velocity=4000
    )

    jubilee.move_xyz_absolute(
        x=x, y=y, velocity=15000
    )

    pipeta.dispense()


def executar_pipetagem():
    pegar_liquido()
    descartar_liquido()


# ============================================================
# EXPERIMENTO 1
# ============================================================

def experimento_1():
    ligar_agitador()
    time.sleep(TEMPO_AGITACAO)
    desligar_agitador()


# ============================================================
# EXPERIMENTO 2
# ============================================================

def experimento_2():

    # Agitação
    agitar()

    # Pipetagem
    pipeta.install()
    executar_pipetagem()

    # Retorna a pipeta para o suporte
    pipeta.uninstall()


# ============================================================
# EXPERIMENTO 3
# ============================================================

def experimento_3():
    ligar_aquecedor()
    time.sleep(TEMPO_AQUECIMENTO)
    desligar_aquecedor()