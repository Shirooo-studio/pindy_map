class PinsController < ApplicationController
  before_action :set_pin, only: %i[ show edit update destroy ]
  before_action :authenticate_user!, only: %i[ create update destroy check ]

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
    # 同一ユーザー x 同一 google_place_id の重複防止
    place_id = pin_params[:google_place_id].presence
    if place_id
      if (existing = Pin.find_by(user_id: current_user.id, google_place_id: place_id))
        return respond_to do |f|
          f.html { redirect_to existing, notice: "すでに保存済みのピンです。" }
          f.json { render json: serialize_pin(existing), status: :ok }
        end
      end
    end

    @pin = current_user.pins.new(pin_params)
    @pin.visibility ||= :company_only

    respond_to do |f|
      if @pin.save
        f.html { redirect_to @pin, notice: "Pin was successfully created." }
        f.json { render json: serialize_pin(@pin), status: :created }
      else
        f.html { render :new, status: :unprocessable_entity }
        f.json { render json: { errors: @pin.errors.full_messages }, status: :unprocessable_entity }
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
    ids_param = params[:google_place_ids].presence || params[:place_ids].presence
    ids = ids_param.to_s.split(",").map(&:strip).reject(&:blank?)
    saved = if ids.any?
      Pin.where(user_id: current_user.id, google_place_id: ids).pluck(:google_place_id)
    else
      []
    end
    render json: saved.index_with(true)
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_pin
      @pin = Pin.find(params[:id])
    end

    # Only allow a list of trusted parameters through.
    def pin_params
      params.require(:pin).permit(:name, :address, :google_place_id, :latitude, :longitude, :visibility)
    end

    # JSON返却を統一
    def serialize_pin(pin)
      {
        id: pin.id,
        name: pin.name,
        address: pin.address,
        latitude: pin.latitude.to_f,
        longitude: pin.longitude.to_f,
        visibility: pin.visibility,
        google_place_id: pin.google_place_id
      }
    end
end
