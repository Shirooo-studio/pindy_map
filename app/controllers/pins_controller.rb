class PinsController < ApplicationController
  before_action :set_pin, only: %i[ show edit update destroy ]
  before_action :authenticate_user!, only: :check

  # GET /pins or /pins.json
  def index
    @pins = Pin.order(created_at: :desc)
    respond_to do |f|
      f.html
      # /pins.json を使いたいときは下を有効化
      # f.json { render json: @pins.select(:id,:name,:address,:latitude,:longitude) }
    end
  end

  # GET /pins/1 or /pins/1.json
  def show
  end

  # GET /pins/new
  def new
    @pin = Pin.new
  end

  # GET /pins/1/edit
  def edit
  end

  # POST /pins
  def create
    @pin = current_user ? current_user.pins.new(pin_params) : Pin.new(pin_params)

    respond_to do |f|
      if @pin.save
        f.html { redirect_to @pin, notice: "Pin was successfully created." }
        f.json { render json:@pin.slice(:id, :name, :place_id), status: :created }
      else
        f.html { render :new, status: :unprocessable_entity }
        f.json { render json:@pin.errors, status: :unprocessable_entity }
      end
    end
  end

  # PATCH/PUT /pins/1
  def update
    if @pin.update(pin_params)
      redirect_to @pin, notice: "Pin was successfully updated.", status: :see_other
    else
      render :edit, status: :unprocessable_entity
    end
  end

  # DELETE /pins/1
  def destroy
    @pin.destroy!
    redirect_to pins_path, notice: "Pin was successfully destroyed.", status: :see_other
  end

  # GET /pins/check?place_ids=aaa,bbb
  def check
    ids = params[:place_ids].to_s.split(",").map(&:strip).reject(&:blank?)
    # ログインユーザー保存済み（place_id 一致）
    saved = Pin.where(user_id: current_user.id, place_id: ids).pluck(:place_id)
    render json: saved.index_with { true }
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_pin
      @pin = Pin.find(params[:id])
    end

    # Only allow a list of trusted parameters through.
    def pin_params
      params.require(:pin).permit(:name, :address, :place_id, :latitude, :longitude, :category, :visibility, :user_id)
    end
end
